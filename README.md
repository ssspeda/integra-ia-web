# Integra IA — Sitio web

Sitio estático de [Integra IA](https://integraia.com) (agencia de agentes de IA, Rosario, Argentina).

Stack: HTML / CSS / JS vanilla. Sin framework, sin bundler de aplicación.
GSAP + ScrollTrigger y las fuentes están self-hosted; three.js se carga por CDN (jsDelivr) para el robot 3D del hero.

## Estructura

```
index.html            Home
agentes/*.html        8 landings de producto (una por agente)
privacidad.html       Política de privacidad (Ley 25.326)
terminos.html         Términos y condiciones
404.html              Página de error propia
css/                  styles.css, fonts.css
js/                   main.js, extras.js, robot3d.js, vendor/ (GSAP)
assets/               Imágenes, fuentes woff2, robot.glb
_headers              Cabeceras (CSP, cache) para Cloudflare Pages / Netlify
.htaccess             Equivalente para hosting Apache
build.ps1             Genera dist/
dist/                 Salida de producción — ESTO es lo que se publica
```

## Build

Requiere Node (usa `npx esbuild`).

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

Copia el sitio a `dist/`, minifica el CSS y JS propios, y excluye los backups y
archivos de diseño no referenciados. **Correr esto antes de cada commit** — `dist/`
se versiona porque es el directorio que publica el hosting.

## Desarrollo local

El robot 3D hace `fetch` del `.glb`, así que no funciona sobre `file://`. Levantar un servidor:

```
npx http-server -p 8080 -e html
```

El `-e html` **no es opcional**: Cloudflare Pages sirve las páginas sin la
extensión (`/privacidad`, no `/privacidad.html`) y redirige con 308 si se pide
con `.html`. Por eso los enlaces internos, los canonical y el sitemap van todos
sin extensión. Sin ese flag, en local todos los links dan 404.

Parámetros de debug en la URL: `?paint=0.6` (congela el pintado del logo),
`?blinkhold`, `?wavehold`, `?wave`.

## Robot 3D

El hero del index usa el modelo real (`assets/robot.glb`, three.js) con
flotación, seguimiento del mouse, parpadeo y saludo.

La página de Fudo usa un **render estático** del mismo modelo
(`assets/robot-flotante.webp`, ~44 KB) con la flotación hecha en CSS. Es a
propósito: ahí el robot es decorativo y la página tiene que priorizar los 4
videos — el `.glb` pesa 861 KB más three.js.

Para regenerar la imagen:

```
npx http-server -p 8080 -e html      # desde la RAÍZ del proyecto
```

Abrir `http://127.0.0.1:8080/tools/render-robot.html`. La página renderiza un
frame y deja el PNG en `window.__png` (data URL). Guardarlo, recortar el
transparente sobrante y convertir a WebP a 760px de ancho.

La cámara y las luces son las mismas que `js/robot3d.js`; lo único distinto es
`toneMappingExposure` (1.34 en vez de 1.1), porque en la página de Fudo el
robot va sobre el fondo oscuro sin el aura del hero detrás.

`tools/` no se deploya: `build.ps1` no lo copia.

## Deploy

Dominio de producción: **integraarg.com** (registrado en Cloudflare).

**Cloudflare** — el dashboard ofrece dos caminos y los dos sirven, porque
ambos aplican `_headers` y `_redirects`. En los dos el **build command va
vacío**: `dist/` ya viene versionado, hay que correr `build.ps1` antes del push.

- *Workers* (lo que el panel ofrece por defecto hoy): usa `wrangler.jsonc`,
  que ya está en la raíz y apunta a `./dist`. Deploy command:
  `npx wrangler deploy`.
- *Pages*: Workers & Pages → pestaña **Pages** → Connect to Git → este repo,
  con **output directory `dist`**. No necesita `wrangler.jsonc`.

Después: **Custom domains** → `integraarg.com` (+ `www`). El DNS se configura
solo porque el dominio ya vive en Cloudflare.

**GitHub Pages** (alternativa; ignora `_headers`, así que se pierde la CSP y el cache-control):

```
git subtree push --prefix dist origin gh-pages
```

Luego Settings → Pages → branch `gh-pages` / `root`.

## Notas

- La access key de Web3Forms en `js/extras.js` es pública por diseño (viaja al cliente).
- `assets/robot-original-backup.glb` es el modelo previo a la simplificación; queda
  versionado como respaldo pero `build.ps1` lo excluye del deploy.
