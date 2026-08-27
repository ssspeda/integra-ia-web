# Build de producción — genera .\dist\ listo para subir al hosting.
# Uso:  powershell -ExecutionPolicy Bypass -File build.ps1
# Requiere Node (usa npx esbuild). Las fuentes del proyecto no se tocan.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$dist = Join-Path $root "dist"

# Limpiar dist
if (Test-Path $dist) { Remove-Item $dist -Recurse -Force }
New-Item -ItemType Directory $dist | Out-Null

# ── Copiar sitio ──
Copy-Item "$root\*.html" $dist
Copy-Item "$root\agentes" "$dist\agentes" -Recurse
Copy-Item "$root\css" "$dist\css" -Recurse
Copy-Item "$root\js" "$dist\js" -Recurse
Copy-Item "$root\assets" "$dist\assets" -Recurse
foreach ($f in "robots.txt", "sitemap.xml", "site.webmanifest", "_headers", "_redirects", ".htaccess") {
  Copy-Item (Join-Path $root $f) $dist
}

# ── Excluir del deploy: backups y fuentes de diseño no referenciadas ──
foreach ($f in "robot-original-backup.glb", "Logo sin fondo.png", "Logo + nombre con fondo.png") {
  $p = Join-Path "$dist\assets" $f
  if (Test-Path $p) { Remove-Item $p }
}

# ── Minificar CSS y JS propios (vendor ya viene .min) ──
$targets = @(
  "css\styles.css", "css\fonts.css",
  "js\main.js", "js\extras.js", "js\robot3d.js", "js\video.js"
)
foreach ($t in $targets) {
  $src = Join-Path $root $t
  $dst = Join-Path $dist $t
  npx --yes esbuild $src --minify --charset=utf8 --outfile=$dst --allow-overwrite --log-level=error
  $kb1 = [math]::Round((Get-Item $src).Length / 1KB, 1)
  $kb2 = [math]::Round((Get-Item $dst).Length / 1KB, 1)
  Write-Host ("  {0}: {1} KB -> {2} KB" -f $t, $kb1, $kb2)
}

# ── Versionado por hash ──────────────────────────────────────────────
# El CSS y el JS se sirven con cache de un año, pero los archivos no cambian
# de nombre entre deploys. Sin esto, al publicar una corrección Cloudflare y
# el navegador siguen entregando la versión vieja durante días: HTML nuevo con
# CSS viejo, que no es "desactualizado", es roto.
#
# Se le agrega ?v=<hash del contenido> a cada referencia. El archivo que no
# cambió conserva su hash y su cache; el que cambió estrena URL y se baja al
# instante. La query string forma parte de la clave de cache de Cloudflare.
$versionables = Get-ChildItem "$dist\css", "$dist\js", "$dist\assets\videos" -Recurse -File -Include *.css, *.js, *.webp -ErrorAction SilentlyContinue

$hashes = @{}
foreach ($f in $versionables) {
  $rel = $f.FullName.Substring($dist.Length + 1).Replace('\', '/')
  $hashes[$rel] = (Get-FileHash $f.FullName -Algorithm MD5).Hash.Substring(0, 8).ToLower()
}

$paginas = Get-ChildItem $dist -Recurse -File -Filter *.html
foreach ($pagina in $paginas) {
  $html = Get-Content $pagina.FullName -Raw -Encoding UTF8
  $original = $html
  foreach ($rel in $hashes.Keys) {
    # captura el prefijo relativo (vacío en la raíz, ../ dentro de agentes/)
    $patron = '(?<attr>(?:href|src)=")(?<pre>(?:\.\./)*)' + [regex]::Escape($rel) + '(?=")'
    $html = [regex]::Replace($html, $patron, { param($m)
      $m.Groups['attr'].Value + $m.Groups['pre'].Value + $rel + '?v=' + $hashes[$rel] })
  }
  if ($html -ne $original) {
    [System.IO.File]::WriteAllText($pagina.FullName, $html, (New-Object System.Text.UTF8Encoding $false))
  }
}
Write-Host ("  versionados: {0} archivos en {1} paginas" -f $hashes.Count, $paginas.Count)

# ── .nojekyll: evita que GitHub Pages ignore archivos con guion bajo (_headers) ──
New-Item -ItemType File (Join-Path $dist ".nojekyll") -Force | Out-Null

$total = [math]::Round((Get-ChildItem $dist -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 2)
Write-Host ""
Write-Host "dist/ listo: $total MB total. Subir el CONTENIDO de dist\ al hosting."
