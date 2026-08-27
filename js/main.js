/* ═══════════════════════════════════════════════
   INTEGRA IA — Motor de animaciones
   GSAP + ScrollTrigger (con fallbacks sin JS/motion)
   ═══════════════════════════════════════════════ */

(function () {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isDesktop = window.matchMedia("(min-width: 769px) and (hover: hover)").matches;

  if (reducedMotion) document.documentElement.classList.add("no-motion");

  /* ── NAV: estado scrolled + burger ─────────── */
  const nav = document.getElementById("nav");
  const burger = document.getElementById("navBurger");
  const navLinks = document.getElementById("navLinks");

  const onScrollNav = () => nav.classList.toggle("is-scrolled", window.scrollY > 24);
  window.addEventListener("scroll", onScrollNav, { passive: true });
  onScrollNav();

  /* El panel del menu no cubre toda la pantalla, asi que un swipe encima
     scrolleaba la pagina de atras y el menu quedaba flotando sobre otra
     seccion. Con el menu abierto se congela el documento: la clase va en
     <html> y el CSS hace el resto. Se evita a proposito el truco de
     position:fixed sobre el body, que cambia el scroll del documento y
     obligaria a recalcular todos los ScrollTrigger al cerrar. */
  const abrirMenu = (open) => {
    navLinks.classList.toggle("is-open", open);
    burger.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    document.documentElement.classList.toggle("nav-abierto", open);
  };

  burger.addEventListener("click", () => abrirMenu(!navLinks.classList.contains("is-open")));
  navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => abrirMenu(false)));

  // Escape cierra, y tocar fuera del panel tambien.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navLinks.classList.contains("is-open")) abrirMenu(false);
  });
  document.addEventListener("click", (e) => {
    if (!navLinks.classList.contains("is-open")) return;
    if (navLinks.contains(e.target) || burger.contains(e.target)) return;
    abrirMenu(false);
  });

  /* Si se agranda la ventana con el menu abierto, el panel desaparece por
     CSS pero el documento quedaria congelado. */
  window.addEventListener("resize", () => {
    if (window.innerWidth > 768 && navLinks.classList.contains("is-open")) abrirMenu(false);
  });

  /* ── CONTADORES animados ───────────────────── */
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const dur = 1600;
    const start = performance.now();

    function frame(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    if (reducedMotion) {
      el.textContent = prefix + target + suffix;
    } else {
      requestAnimationFrame(frame);
    }
  }

  const countObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          animateCount(e.target);
          countObserver.unobserve(e.target);
        }
      });
    },
    { threshold: 0.6 }
  );
  document.querySelectorAll("[data-count]").forEach((el) => countObserver.observe(el));

  /* ── CASOS: activar barras de métricas ───────
     Se llenan al entrar y SOLO se vacían si el caso vuelve a quedar
     por debajo del viewport (scroll hacia arriba). Al seguir bajando
     (el caso sale por arriba) quedan llenas. */
  const caseObserver = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-inview");
        } else if (e.boundingClientRect.top > 0) {
          e.target.classList.remove("is-inview");
        }
      }),
    { threshold: 0.35 }
  );
  document.querySelectorAll(".case").forEach((el) => caseObserver.observe(el));

  /* ── MANIFIESTO: dividir en palabras ───────── */
  const manifesto = document.getElementById("manifestoText");
  if (manifesto) {
    const wrapWords = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (/^\s+$/.test(part) || part === "") {
              frag.appendChild(document.createTextNode(part));
            } else {
              const s = document.createElement("span");
              s.className = "word";
              s.textContent = part;
              frag.appendChild(s);
            }
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          wrapWords(child);
        }
      });
    };
    wrapWords(manifesto);
  }

  /* ── Fallback sin GSAP: revelar todo ───────── */
  function fallbackReveal() {
    document.querySelectorAll(".reveal-up, .hero__title .line > span").forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    document.querySelectorAll(".manifesto__text .word").forEach((w) => w.classList.add("is-lit"));
    document.querySelectorAll(".agent").forEach((a) => a.classList.add("is-active"));
    // Logo del hero: sin animación de pintado, mostrarlo completo
    const paintAll = document.getElementById("paintAll");
    if (paintAll) paintAll.setAttribute("opacity", "1");
  }

  /* ── GSAP ──────────────────────────────────── */
  function initGsap() {
    if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
      fallbackReveal();
      return;
    }
    if (reducedMotion) {
      fallbackReveal();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    /* Las posiciones de los ScrollTrigger se calculan con la altura que la
       página tiene en ese instante. Si después entran imágenes diferidas o
       las fuentes, todo queda corrido: entrando por un ancla (#casos) la
       sección arrancaba con los triggers pasados y las tarjetas invisibles.
       Por eso se recalcula cuando el layout ya no se mueve más. */
    (function refrescos() {
      const refrescar = () => ScrollTrigger.refresh();
      window.addEventListener("load", refrescar);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(refrescar);
      document.querySelectorAll("img[loading='lazy']").forEach((img) => {
        if (!img.complete) img.addEventListener("load", refrescar, { once: true });
      });
    })();

    /* HERO: el logo se "pinta" con UNA pincelada continua (path en forma de 8).
       Sin JS o sin GSAP el trazo queda sin animar → logo completo visible. */
    const paintPath = document.getElementById("paintPath");
    const paintAll = document.getElementById("paintAll");
    if (paintPath && paintAll) {
      const len = paintPath.getTotalLength();
      gsap.set(paintPath, { strokeDasharray: len, strokeDashoffset: len });
      const paintTl = gsap.timeline({ delay: 0.25 });
      paintTl
        .from(".hero__logo-wrap", { opacity: 0, scale: 0.85, duration: 0.6, ease: "power2.out", clearProps: "transform" }, 0)
        .to(paintPath, { strokeDashoffset: 0, duration: 2.1, ease: "power1.inOut" }, 0.15)
        .to(paintAll, { opacity: 1, duration: 0.45, ease: "power1.out" }, ">-0.05");

      // Debug: ?paint=0.6 congela la animación en ese punto
      const pp = new URLSearchParams(location.search).get("paint");
      if (pp !== null) paintTl.progress(parseFloat(pp)).pause();
    }

    /* HERO: título línea por línea */
    gsap.to(".hero__title .line > span", {
      y: 0,
      duration: 1.1,
      ease: "power4.out",
      stagger: 0.14,
      delay: 0.5,
    });

    /* HERO: reveals secuenciales */
    gsap.to(".hero .reveal-up", {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.12,
      delay: 0.9,
    });

    /* REVEALS genéricos por scroll */
    document.querySelectorAll(".reveal-up").forEach((el) => {
      if (el.closest(".hero")) return; // el hero ya tiene su timeline
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.95,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 86%" },
      });
    });

    /* MANIFIESTO: palabras que se encienden con scrub */
    const words = document.querySelectorAll(".manifesto__text .word");
    if (words.length) {
      ScrollTrigger.create({
        trigger: ".manifesto",
        start: "top 75%",
        end: "bottom 55%",
        scrub: 0.4,
        onUpdate(self) {
          const lit = Math.floor(self.progress * words.length);
          words.forEach((w, i) => w.classList.toggle("is-lit", i <= lit));
        },
      });
    }

    /* AGENTES: path que se dibuja con el scroll + chispa en la punta (desktop) */
    const drawPath = document.getElementById("agentsPathDraw");
    const ghostPath = document.querySelector(".agents__path--ghost");
    const pathSvg = document.querySelector(".agents__path-svg");
    const journey = document.getElementById("agentsJourney");
    const spark = document.getElementById("agentsSpark");
    if (drawPath && ghostPath && pathSvg && journey && isDesktop) {
      let len = 0;
      let lastProgress = 0;

      /* El path se genera desde la posición REAL de cada nodo:
         pasa exacto por todos sin importar resolución ni altura de tarjetas */
      function buildPath() {
        const w = journey.clientWidth;
        const h = journey.clientHeight;
        pathSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        const jr = journey.getBoundingClientRect();
        const pts = [...journey.querySelectorAll(".agent__node")].map((n) => {
          const r = n.getBoundingClientRect();
          return { x: r.left + r.width / 2 - jr.left, y: r.top + r.height / 2 - jr.top };
        });

        /* Spline Catmull-Rom → Bézier: la tangente en cada nodo es compartida
           por los dos tramos que lo tocan, así la curva fluye sin vértices */
        const P = [{ x: w / 2, y: 0 }, ...pts, { x: w / 2, y: h }];
        const T = P.map((_, i) => {
          const a = P[Math.max(0, i - 1)];
          const b = P[Math.min(P.length - 1, i + 1)];
          return { x: ((b.x - a.x) / 2) * 1.9, y: (b.y - a.y) / 2 }; // ×1.9 amplía el barrido lateral
        });
        let d = `M ${P[0].x} ${P[0].y}`;
        for (let i = 0; i < P.length - 1; i++) {
          const c1x = P[i].x + T[i].x / 3;
          const c1y = P[i].y + T[i].y / 3;
          const c2x = P[i + 1].x - T[i + 1].x / 3;
          const c2y = P[i + 1].y - T[i + 1].y / 3;
          d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${P[i + 1].x.toFixed(1)} ${P[i + 1].y.toFixed(1)}`;
        }

        ghostPath.setAttribute("d", d);
        drawPath.setAttribute("d", d);
        const grad = document.getElementById("path-grad");
        if (grad) grad.setAttribute("y2", h); // gradiente cubre el alto real
        len = drawPath.getTotalLength();
        gsap.set(drawPath, { strokeDasharray: len, strokeDashoffset: len * (1 - lastProgress) });
      }
      buildPath();

      // Paleta cíclica con violeta y púrpura: el cambio se nota fuerte al scrollear
      const PALETTE = ["#2b4bff", "#8b5cf6", "#c44bf7", "#4cc3f7", "#7dd6ff", "#2b4bff"];
      const gradStops = document.querySelectorAll("#path-grad stop");

      /* La punta del trazo sigue una línea fija del viewport (62% de alto).
         El progreso NO es lineal con el scroll: se busca el largo de path
         cuya Y coincide con esa línea (la Y del path es monótona creciente,
         así que una búsqueda binaria alcanza). Sin esto el trazo se
         rellenaba desfasado respecto de lo que se ve en pantalla. */
      function lenAtY(yTarget) {
        let lo = 0, hi = len;
        for (let i = 0; i < 22; i++) {
          const mid = (lo + hi) / 2;
          if (drawPath.getPointAtLength(mid).y < yTarget) lo = mid;
          else hi = mid;
        }
        return (lo + hi) / 2;
      }

      ScrollTrigger.create({
        trigger: journey,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
        onUpdate() {
          const jr = journey.getBoundingClientRect();
          const yTarget = Math.max(0, Math.min(jr.height, window.innerHeight * 0.62 - jr.top));
          const t = lenAtY(yTarget);
          const p = (lastProgress = t / len);
          gsap.set(drawPath, { strokeDashoffset: len - t });
          // Colores del gradiente rotan suave con el scroll
          gradStops.forEach((stop, i) => {
            const c = (p * 2.5 + i * 0.3) % 1; // ciclo rápido + stops bien separados
            stop.setAttribute("stop-color", gsap.utils.interpolate(PALETTE, c));
          });
          if (spark) {
            const pt = drawPath.getPointAtLength(t);
            spark.setAttribute("transform", `translate(${pt.x}, ${pt.y})`);
            // visible solo mientras el trazo avanza; se apaga en los extremos
            spark.setAttribute("opacity", p > 0.004 && p < 0.996 ? "1" : "0");
          }
        },
      });

      /* Reconstruir en resize (debounced) y tras la carga completa (fuentes ya medidas) */
      let resizeT;
      window.addEventListener("resize", () => {
        clearTimeout(resizeT);
        resizeT = setTimeout(() => {
          buildPath();
          ScrollTrigger.refresh();
        }, 200);
      });
      window.addEventListener("load", buildPath);
    }

    /* AGENTES (mobile): línea de progreso vertical */
    if (journey && !isDesktop) {
      ScrollTrigger.create({
        trigger: journey,
        start: "top 70%",
        end: "bottom 75%",
        scrub: 0.5,
        onUpdate(self) {
          journey.style.setProperty("--progress", (self.progress * 100).toFixed(2) + "%");
        },
      });
    }

    /* AGENTES: nodos + tarjetas */
    document.querySelectorAll(".agent").forEach((agent) => {
      ScrollTrigger.create({
        trigger: agent,
        start: "top 62%",
        onEnter: () => agent.classList.add("is-active"),
        onLeaveBack: () => agent.classList.remove("is-active"),
      });
      const card = agent.querySelector(".agent__card");
      const fromX = agent.classList.contains("agent--right") ? 60 : -60;
      gsap.from(card, {
        opacity: 0,
        x: isDesktop ? fromX : 0,
        y: isDesktop ? 0 : 40,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: agent, start: "top 72%" },
      });

      /* El mockup del lado opuesto aparece con el scroll (solo desktop) */
      const aside = agent.querySelector(".agent__aside");
      if (aside && isDesktop) {
        gsap.from(aside, {
          opacity: 0,
          x: -fromX,        // entra desde el lado contrario a la tarjeta
          y: 26,
          scale: 0.92,
          duration: 1.1,
          ease: "power3.out",
          scrollTrigger: { trigger: agent, start: "top 70%" },
        });
      }
    });

    /* CASOS (desktop): efecto stack — tarjeta anterior se encoge */
    if (isDesktop) {
      const cards = gsap.utils.toArray(".case");
      cards.forEach((card, i) => {
        if (i === cards.length - 1) return;
        /* La tarjeta anterior solo se ENCOGE cuando la siguiente la cubre.
           Nada de animar la opacidad: las tarjetas son sticky y tienen fondo
           solido, asi que la siguiente ya las tapa sola. Cuando el fade
           llegaba a 0, bastaba con que los triggers quedaran mal calculados
           --- entrar por #casos, por ejemplo --- para que la seccion entera
           se viera vacia. Sin opacidad animada eso no puede pasar: en el
           peor caso una tarjeta queda encogida, nunca invisible. */
        gsap.to(card.querySelector(".case__inner"), {
          scale: 0.93,
          ease: "none",
          scrollTrigger: {
            trigger: cards[i + 1],
            start: "top 80%",
            end: "top top+=140",
            scrub: true,
            invalidateOnRefresh: true,
          },
        });
      });
    }

    /* CTA FINAL: loop gigante rota lento con scrub */
    gsap.to(".cta-final__loop", {
      rotate: 18,
      scale: 1.15,
      ease: "none",
      scrollTrigger: {
        trigger: ".cta-final",
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
      },
    });
  }

  /* GSAP carga con defer: esperar a que esté disponible */
  if (document.readyState === "complete" || document.readyState === "interactive") {
    waitGsap();
  } else {
    document.addEventListener("DOMContentLoaded", waitGsap);
  }
  function waitGsap() {
    let tries = 0;
    (function check() {
      if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
        initGsap();
      } else if (tries++ < 40) {
        setTimeout(check, 100);
      } else {
        fallbackReveal(); // CDN bloqueado u offline: contenido visible igual
      }
    })();
  }

  /* ── SCROLLSPY: resalta sección activa en nav ── */
  const spyLinks = [...document.querySelectorAll('.nav__links > a[href^="#"]:not(.btn)')];
  const spySections = spyLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  if (spySections.length) {
    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          spyLinks.forEach((a) =>
            a.classList.toggle("is-active", a.getAttribute("href") === "#" + e.target.id)
          );
        });
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );
    spySections.forEach((s) => spyObserver.observe(s));
  }

  /* ── CURSOR GLOW (desktop) ─────────────────── */
  if (isDesktop && !reducedMotion) {
    const glow = document.createElement("div");
    glow.className = "cursor-glow";
    document.body.appendChild(glow);
    let gx = -500, gy = -500, tx = gx, ty = gy;
    window.addEventListener("mousemove", (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function loop() {
      gx += (tx - gx) * 0.08;
      gy += (ty - gy) * 0.08;
      glow.style.left = gx + "px";
      glow.style.top = gy + "px";
      requestAnimationFrame(loop);
    })();
  }

  /* ── BOTONES MAGNÉTICOS (desktop) ──────────── */
  if (isDesktop && !reducedMotion) {
    document.querySelectorAll(".btn--magnetic").forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "";
      });
    });
  }
})();
