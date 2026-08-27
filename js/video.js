/* ═══════════════════════════════════════════════
   INTEGRA IA — Videos de YouTube (carga diferida)
   Sin dependencias. Degrada bien si algo falta.

   Uso en el HTML:
     <div class="ytlite" data-yt="ID_DEL_VIDEO" data-title="Título accesible"
          data-mute="1"        <!-- opcional: arranca sin audio -->
          data-hide-title="1"  <!-- opcional: tapa el titulo que pone YouTube -->
          data-speed="1.5">    <!-- opcional: velocidad de arranque -->
       <div class="demo__placeholder" …>
         <img class="ytlite__poster" src="…" alt="" />   ← frame del video
         …botón de play + texto…
       </div>
     </div>

   Mientras data-yt esté vacío, el bloque queda como cartel
   «próximamente» y el poster no se muestra (lo tapa el CSS). Al pegar
   el ID, el placeholder se vuelve un botón y recién al hacer clic se
   inserta el iframe: la página no le pide NADA a Google hasta que el
   visitante lo pide (el poster es nuestro, sale de assets/videos/).
   ═══════════════════════════════════════════════ */

(function () {
  "use strict";

  const boxes = document.querySelectorAll(".ytlite[data-yt]");
  if (!boxes.length) return;

  /* Pone el video a data-speed apenas arranca.
     Se le habla al reproductor por postMessage con enablejsapi=1, en vez de
     cargar https://www.youtube.com/iframe_api: la API pesa y habría que
     abrirle un dominio más a la CSP para hacer exactamente lo mismo.
     El comando solo entra cuando el reproductor ya terminó de cargar, y no
     avisa cuándo es: por eso se reintenta un rato corto y se corta al
     confirmar que quedó aplicado. Si algo falla, el video se ve a 1x, que
     es una degradación perfectamente aceptable. */
  function ponerVelocidad(frame, velocidad) {
    const destino = "https://www.youtube-nocookie.com";
    const mandar = (func, args) => {
      try {
        frame.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: func, args: args || [] }), destino);
      } catch (e) { /* todavía no hay contentWindow: lo toma el proximo intento */ }
    };

    let listo = false;
    const alRecibir = (e) => {
      if (e.source !== frame.contentWindow) return;
      let d; try { d = JSON.parse(e.data); } catch (_) { return; }
      if (d && d.info && d.info.playbackRate === velocidad) {
        listo = true;
        clearInterval(reintento);
        window.removeEventListener("message", alRecibir);
      }
    };
    window.addEventListener("message", alRecibir);

    let intentos = 0;
    const reintento = setInterval(() => {
      if (listo || ++intentos > 24) {           // ~12s de margen
        clearInterval(reintento);
        window.removeEventListener("message", alRecibir);
        return;
      }
      // handshake: sin esto el reproductor ignora los comandos y no responde
      try {
        frame.contentWindow.postMessage(
          JSON.stringify({ event: "listening", id: 1, channel: "widget" }), destino);
      } catch (e) { return; }
      mandar("setPlaybackRate", [velocidad]);
    }, 500);
  }

  boxes.forEach((box) => {
    const id = (box.dataset.yt || "").trim();
    if (!id) return; // sin ID todavía: se queda el cartel de «próximamente»

    const ph = box.querySelector(".demo__placeholder");
    if (!ph) return;

    const title = box.dataset.title || "Ver el video";

    // El placeholder pasa de imagen decorativa a botón real.
    ph.removeAttribute("role");
    ph.removeAttribute("aria-label");
    ph.setAttribute("tabindex", "0");
    ph.setAttribute("role", "button");
    ph.setAttribute("aria-label", "Reproducir: " + title);
    box.classList.add("ytlite--ready");

    const soon = ph.querySelector(".demo__soon");
    if (soon) soon.textContent = "Ver el video";

    let loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;

      const frame = document.createElement("iframe");
      frame.className = "demo__media";
      frame.title = title;
      frame.allow =
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.allowFullscreen = true;

      /* El iframe se inserta primero y el src se asigna después, en el
         frame siguiente: así el reproductor de YouTube ya encuentra su
         caja de 16:9 hecha cuando mide al arrancar (mide una sola vez y
         no se reajusta solo). Los atributos width/height le dan la
         proporción correcta antes de que el CSS lo estire al marco.
         Sin loading="lazy": el iframe nace de un clic, o sea siempre a
         la vista, y diferirlo solo agrega latencia. */
      frame.width = 1280;
      frame.height = 720;

      ph.replaceWith(frame);

      /* Tapa el rótulo con el título y el canal que YouTube encima arriba
         a la izquierda. No hay parámetro que lo saque: probado, con
         controls=0 aparece igual. Un degradado oscuro sobre la franja
         superior lo cubre, y como se dibuja encima del iframe también
         atrapa el clic que se iría a youtube.com. En estos videos ahí
         arriba solo está la barra de pestañas del navegador grabado, o
         sea que no se pierde nada de la demo. */
      if (box.dataset.hideTitle === "1") {
        const tapa = document.createElement("span");
        tapa.className = "ytlite__tapa";
        tapa.setAttribute("aria-hidden", "true");
        frame.after(tapa);
      }

      /* data-mute="1" arranca sin audio (el visitante puede activarlo
         desde el propio reproductor). Se usa donde el video acompaña
         y no explica: que suene solo al hacer clic espanta. */
      const mute = box.dataset.mute === "1" ? "&mute=1" : "";

      /* data-speed lo necesita para poder mandarle ordenes al reproductor. */
      const velocidad = parseFloat(box.dataset.speed);
      const conApi = velocidad > 0 ? "&enablejsapi=1" : "";

      const src =
        "https://www.youtube-nocookie.com/embed/" +
        encodeURIComponent(id) +
        "?autoplay=1&rel=0&modestbranding=1&playsinline=1" +
        mute + conApi;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          frame.src = src;
        });
      });

      if (velocidad > 0) ponerVelocidad(frame, velocidad);
    };

    ph.addEventListener("click", load);
    ph.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        load();
      }
    });
    // Precalentar la conexión al pasar el mouse: el play se siente instantáneo.
    ph.addEventListener(
      "pointerenter",
      () => {
        if (document.getElementById("yt-preconnect")) return;
        const l = document.createElement("link");
        l.id = "yt-preconnect";
        l.rel = "preconnect";
        l.href = "https://www.youtube-nocookie.com";
        document.head.appendChild(l);
      },
      { once: true }
    );
  });
})();
