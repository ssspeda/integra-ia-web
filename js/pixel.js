/*
 * Meta Pixel (dataset "Integra's Pixel").
 *
 * - PageView en cada página: arma públicos de retargeting (visitantes de la web).
 * - Contact al tocar cualquier botón de WhatsApp: es el resultado que optimiza
 *   la campaña de Meta que manda tráfico a la web (FUDO - WEB).
 *
 * Los botones de WhatsApp abren en pestaña nueva (target="_blank"), así que la
 * página no se descarga y el evento sale completo antes de irse.
 * Si cambia el CSP de _headers / .htaccess, connect.facebook.net y
 * www.facebook.com tienen que seguir permitidos.
 */
(function () {
  var PIXEL_ID = "1260988152151121";

  /* Snippet oficial de Meta (base code), sin cambios funcionales. */
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0";
    n.queue = []; t = b.createElement(e); t.async = !0;
    t.src = v; s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");

  fbq("init", PIXEL_ID);
  fbq("track", "PageView");

  var WA = /(^https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\/)|(^whatsapp:)/i;

  // Delegado en document: cubre los links que extras.js arma o cambia en runtime
  // (calculadora ROI, quiz), no solo los que están en el HTML.
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!a || !WA.test(a.href)) return;
    fbq("track", "Contact", {
      content_name: location.pathname.replace(/\/$/, "") || "/",
      content_category: "whatsapp"
    });
  }, true);
})();
