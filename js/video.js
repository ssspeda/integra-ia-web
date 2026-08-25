/* ═══════════════════════════════════════════════
   INTEGRA IA — Videos de YouTube (carga diferida)
   Sin dependencias. Degrada bien si algo falta.

   Uso en el HTML:
     <div class="ytlite" data-yt="ID_DEL_VIDEO" data-title="Título accesible"
          data-mute="1">   <!-- data-mute es opcional: arranca sin audio -->
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

      /* data-mute="1" arranca sin audio (el visitante puede activarlo
         desde el propio reproductor). Se usa donde el video acompaña
         y no explica: que suene solo al hacer clic espanta. */
      const mute = box.dataset.mute === "1" ? "&mute=1" : "";

      const src =
        "https://www.youtube-nocookie.com/embed/" +
        encodeURIComponent(id) +
        "?autoplay=1&rel=0&modestbranding=1&playsinline=1" +
        mute;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          frame.src = src;
        });
      });
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
