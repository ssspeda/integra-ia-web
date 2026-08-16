/* ═══════════════════════════════════════════════
   INTEGRA IA — Calculadora de ahorro + Formulario
   Sin dependencias. Degrada bien si algo falta.
   ═══════════════════════════════════════════════ */

(function () {
  "use strict";

  /* ╔═══ CONFIG ═══╗
     Los leads llegan al mail vía Web3Forms (gratis, sin servidor).
     1) Entrá a https://web3forms.com  2) poné integraiaarg@gmail.com
     3) te mandan una "Access Key" al mail  4) pegala acá abajo.
     Vacío "" = el form cae al fallback de WhatsApp (sigue funcionando). */
  const WEB3FORMS_KEY = "64e3ecec-0a13-4a67-9b40-694949de3807";
  const CONTACT_ENDPOINT = "https://api.web3forms.com/submit";
  const WA_NUMBER = "5493412685888";

  /* ── CALCULADORA DE AHORRO ─────────────────── */
  (function roi() {
    const form = document.getElementById("roiForm");
    if (!form) return;

    const msgs = document.getElementById("roiMsgs");
    const min = document.getElementById("roiMin");
    const rate = document.getElementById("roiRate");
    const msgsOut = document.getElementById("roiMsgsOut");
    const minOut = document.getElementById("roiMinOut");
    const rateOut = document.getElementById("roiRateOut");
    const hoursEl = document.getElementById("roiHours");
    const moneyEl = document.getElementById("roiMoney");
    const cta = document.getElementById("roiCta");

    const fmtInt = (n) => new Intl.NumberFormat("es-AR").format(Math.round(n));
    const fmtMoney = (n) => "$" + new Intl.NumberFormat("es-AR").format(Math.round(n));

    // automatización resuelve ~80% de los mensajes sin intervención humana
    const AUTO = 0.8;

    function paintRange(el) {
      const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
      el.style.setProperty("--fill", pct + "%");
    }

    function update() {
      const m = +msgs.value;
      const t = +min.value;
      const r = +rate.value;

      msgsOut.textContent = fmtInt(m);
      minOut.textContent = t;
      rateOut.textContent = fmtMoney(r);

      // minutos/día ahorrados → horas/mes (30 días)
      const hoursMonth = (m * t * AUTO * 30) / 60;
      hoursEl.textContent = fmtInt(hoursMonth) + " hs";
      moneyEl.textContent = r > 0 ? fmtMoney(hoursMonth * r) : "—";

      [msgs, min, rate].forEach(paintRange);

      if (cta) {
        const txt =
          "Hola Integra IA, calculé mi ahorro: ~" +
          fmtInt(hoursMonth) +
          " hs/mes" +
          (r > 0 ? " (" + fmtMoney(hoursMonth * r) + ")" : "") +
          ". Quiero automatizar mi negocio.";
        cta.href = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(txt);
      }
    }

    [msgs, min, rate].forEach((el) => el.addEventListener("input", update));
    update();
  })();

  /* ── FORMULARIO DE CONTACTO ────────────────── */
  (function contact() {
    const form = document.getElementById("contactForm");
    if (!form) return;
    const statusEl = document.getElementById("cfStatus");
    const submit = document.getElementById("cfSubmit");
    const honeypot = document.getElementById("cfCompany");

    function setStatus(msg, type) {
      statusEl.textContent = msg;
      statusEl.className = "contact__status" + (type ? " is-" + type : "");
    }

    function waFallback(data) {
      const txt =
        "Hola Integra IA, soy " + data.name + " de " + data.business + ".\n" +
        "Email: " + data.email + (data.phone ? "\nWhatsApp: " + data.phone : "") +
        "\nQuiero automatizar: " + data.message;
      return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(txt);
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // honeypot: si está lleno, es bot → fingir éxito y no enviar
      if (honeypot && honeypot.value) {
        setStatus("¡Gracias! Te contactamos pronto.", "ok");
        form.reset();
        return;
      }

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      const data = {
        name: form.name.value.trim(),
        business: form.business.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        message: form.message.value.trim(),
        source: "web",
        page: location.href,
      };

      // Sin Access Key configurada → abrir WhatsApp con el mensaje armado
      if (!WEB3FORMS_KEY) {
        window.open(waFallback(data), "_blank", "noopener");
        setStatus("Te llevamos a WhatsApp para terminar de enviar tu consulta.", "ok");
        form.reset();
        return;
      }

      submit.disabled = true;
      const original = submit.textContent;
      submit.textContent = "Enviando…";
      setStatus("", "");

      // Payload Web3Forms → llega al mail configurado en la Access Key
      const payload = {
        access_key: WEB3FORMS_KEY,
        subject: "Nueva consulta web — " + data.business,
        from_name: "Integra IA · Web",
        name: data.name,
        email: data.email,
        Negocio: data.business,
        WhatsApp: data.phone || "—",
        message: data.message,
        Origen: data.page,
      };

      try {
        const res = await fetch(CONTACT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.success) throw new Error(json.message || "HTTP " + res.status);
        setStatus("¡Gracias! Recibimos tu consulta. Te escribimos en menos de 24 hs hábiles.", "ok");
        form.reset();
      } catch (err) {
        // Si falla el envío, no perdemos el lead: ofrecemos WhatsApp
        setStatus("No pudimos enviar el formulario. Probá por WhatsApp y lo resolvemos al instante.", "err");
        window.open(waFallback(data), "_blank", "noopener");
      } finally {
        submit.disabled = false;
        submit.textContent = original;
      }
    });
  })();

  /* ── QUIZ: ¿QUÉ AGENTE NECESITA TU NEGOCIO? ── */
  (function quiz() {
    const card = document.getElementById("quizCard");
    if (!card) return;

    const AGENTS = {
      "gestor-reservas": ["01", "Agente Gestor de Reservas", "Reservas confirmadas solas 24/7, recordatorios que eliminan ausencias y reseñas de Google después de cada visita."],
      "atencion-cliente": ["02", "Agente de Atención al Cliente", "Responde WhatsApp e Instagram al instante con el tono de tu marca, y retoma solo las ventas que se enfrían."],
      "sistema-fudo": ["03", "Sistema Modular para Fudo", "Nuestro agente estrella: carga automática de facturas por foto, stock, órdenes de compra y producción, pedidos y deliverys."],
      "setter-comercial": ["04", "Agente Setter Comercial", "Conversa con cada lead, filtra a los curiosos y llena tu calendario solo con gente lista para comprar."],
      "secretario-ejecutivo": ["05", "Agente Secretario Ejecutivo", "Tu agenda coordinada sola: reuniones, recordatorios, conflictos de horario resueltos y reagendas."],
      "prospector": ["06", "Agente Prospector", "Encuentra clientes potenciales todos los días y les escribe mensajes personalizados que abren conversación."],
      "ecommerce-manager": ["07", "Agente E-Commerce Manager", "Tu tienda gestionada desde WhatsApp: métricas, campañas y seguimiento post-venta que genera recompras."],
      "estudio-creativo": ["08", "Agente Estudio Creativo", "Guiones basados en tendencias y videos ultra realistas con tu imagen, sin grabar nada."],
    };

    /* Cada opción suma puntos a uno o más agentes */
    const QUESTIONS = [
      { q: "¿Qué tipo de negocio tenés?", opts: [
        ["Gastronomía (restaurante, cafetería, delivery)", { "sistema-fudo": 3, "gestor-reservas": 2 }],
        ["Atiendo con turnos o reservas (canchas, consultorio, estética)", { "gestor-reservas": 3, "secretario-ejecutivo": 1 }],
        ["Tienda o e-commerce", { "ecommerce-manager": 2, "atencion-cliente": 2 }],
        ["Servicios, B2B o marca personal", { "setter-comercial": 2, "prospector": 2, "estudio-creativo": 1 }],
      ]},
      { q: "¿Dónde se te va más tiempo hoy?", opts: [
        ["Respondiendo siempre las mismas consultas", { "atencion-cliente": 3 }],
        ["Coordinando turnos, reservas o mi agenda", { "gestor-reservas": 2, "secretario-ejecutivo": 2 }],
        ["Facturas, stock, pedidos y papeles", { "sistema-fudo": 3 }],
        ["Buscando clientes y siguiendo interesados", { "prospector": 2, "setter-comercial": 2 }],
      ]},
      { q: "¿Qué querés lograr primero?", opts: [
        ["Cerrar más ventas", { "setter-comercial": 2, "ecommerce-manager": 1, "atencion-cliente": 1 }],
        ["Recuperar horas de mi semana", { "secretario-ejecutivo": 2, "sistema-fudo": 1, "atencion-cliente": 1 }],
        ["Más reseñas y mejor reputación", { "gestor-reservas": 3 }],
        ["Contenido constante para mis redes", { "estudio-creativo": 3 }],
      ]},
    ];

    const step = document.getElementById("quizStep");
    const progressEl = document.getElementById("quizProgress");
    const questionEl = document.getElementById("quizQuestion");
    const optsEl = document.getElementById("quizOpts");
    const result = document.getElementById("quizResult");

    let current = 0;
    const scores = {};

    function render() {
      const item = QUESTIONS[current];
      progressEl.textContent = "Pregunta " + (current + 1) + " de " + QUESTIONS.length;
      questionEl.textContent = item.q;
      optsEl.innerHTML = "";
      item.opts.forEach(([label, points]) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "quiz__opt";
        btn.textContent = label;
        btn.addEventListener("click", () => {
          Object.keys(points).forEach((k) => { scores[k] = (scores[k] || 0) + points[k]; });
          current++;
          current < QUESTIONS.length ? render() : showResult();
        });
        optsEl.appendChild(btn);
      });
    }

    function showResult() {
      const winner = Object.keys(AGENTS).reduce((best, k) =>
        (scores[k] || 0) > (scores[best] || 0) ? k : best, Object.keys(AGENTS)[0]);
      const [num, name, desc] = AGENTS[winner];
      document.getElementById("quizResNum").textContent = num;
      document.getElementById("quizResName").textContent = name;
      document.getElementById("quizResDesc").textContent = desc;
      document.getElementById("quizResLink").href = "agentes/" + winner + ".html";
      document.getElementById("quizResWa").href = "https://wa.me/" + WA_NUMBER + "?text=" +
        encodeURIComponent("Hola Integra IA, hice el quiz de la web y me recomendó el " + name + ". Quiero saber más.");
      step.hidden = true;
      result.hidden = false;
    }

    document.getElementById("quizRestart").addEventListener("click", () => {
      current = 0;
      Object.keys(scores).forEach((k) => delete scores[k]);
      result.hidden = true;
      step.hidden = false;
      render();
    });

    render();
  })();

  /* ── CUPOS DEL MES (determinístico por día) ── */
  /* N entre 2 y 8, fijo durante todo el día y distinto entre días:
     el seed es la fecha, mezclado con xorshift. */
  (function spots() {
    const el = document.getElementById("ctaSpots");
    if (!el) return;
    const d = new Date();
    let s = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >>> 17)) >>> 0;
    s = (s ^ (s << 5)) >>> 0;
    el.textContent = 2 + (s % 7);
  })();

  /* ── TARJETAS DE AGENTE → CLICK LLEVA A SU PÁGINA ── */
  /* La tarjeta entera navega al link .agent__more que tiene adentro.
     Si el click fue sobre un <a> real, se respeta ese link. */
  (function clickableAgentCards() {
    document.querySelectorAll(".agent__card").forEach((card) => {
      const link = card.querySelector(".agent__more");
      if (!link) return;
      card.style.cursor = "pointer";
      card.addEventListener("click", (e) => {
        if (e.target.closest("a")) return;
        // respetar selección de texto: no navegar si el usuario está seleccionando
        const sel = window.getSelection();
        if (sel && sel.type === "Range") return;
        window.location.href = link.href;
      });
    });
  })();

  /* ── BARRA CTA FIJA EN MOBILE ──────────────── */
  /* Aparece al pasar el hero y se esconde cuando el CTA final o el footer
     entran en viewport (para no duplicar el mismo CTA dos veces seguidas).
     En desktop la barra no existe (display:none por CSS). */
  (function mobileCta() {
    const bar = document.getElementById("mcta");
    const hero = document.getElementById("inicio");
    if (!bar || !hero || !("IntersectionObserver" in window)) return;

    let pastHero = false;
    let nearEnd = false;

    function paint() {
      const show = pastHero && !nearEnd;
      bar.classList.toggle("is-visible", show);
      document.body.classList.toggle("mcta-visible", show);
    }

    new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        pastHero = !e.isIntersecting && e.boundingClientRect.top < 0;
      });
      paint();
    }).observe(hero);

    const enders = [...document.querySelectorAll(".cta-final, .footer")];
    if (enders.length) {
      const inview = new Set();
      const endObs = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) inview.add(e.target);
          else inview.delete(e.target);
        });
        nearEnd = inview.size > 0;
        paint();
      });
      enders.forEach((el) => endObs.observe(el));
    }
  })();
})();
