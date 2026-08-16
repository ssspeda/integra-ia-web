/* ═══════════════════════════════════════════════
   INTEGRA IA — Robot 3D del hero (three.js)
   Modelo "integrabot": 25 piezas separadas.
   - Cabeza (casco+visor+ojos+boca+orejas) sigue el mouse
   - Parpadeo con los ojos reales del modelo
   - Saludo con el brazo cada ~20s
   - Base = logo infinito de Integra (viene en el modelo)
   Carga diferida, DPR limitado, pausa fuera de pantalla.
   Si algo falla, el hero queda como está.
   ═══════════════════════════════════════════════ */

const container = document.getElementById("heroRobot");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover)").matches;
const params = new URLSearchParams(location.search);

/* El modelo mira hacia +X: -90° en Y lo pone de frente a cámara */
const FACE_FRONT = -Math.PI / 2;

/* Mapa de piezas (coordenadas del modelo, alto total = 1) */
const HEAD_PARTS = ["tripo_part_1", "tripo_part_6", "tripo_part_21", "tripo_part_22", "tripo_part_27", "tripo_part_10", "tripo_part_11"];
const EYE_PARTS = ["tripo_part_21", "tripo_part_22"];
const ARM_PARTS = ["tripo_part_8", "tripo_part_18", "tripo_part_25"]; // brazo + mano + hombro (lado z-)
const NECK = { x: -0.03, y: 0.62, z: 0 };
const SHOULDER = { x: -0.04, y: 0.555, z: -0.115 };

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

async function init() {
  if (!container || !webglOk()) return;

  const [THREE, { GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import("three"),
    import("three/addons/loaders/GLTFLoader.js"),
    import("three/addons/libs/meshopt_decoder.module.js"),
  ]);

  /* ── Renderer ── */
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, container.clientWidth / container.clientHeight, 0.1, 30);
  camera.position.set(0, 1.35, 4.4);
  camera.lookAt(0, 1.0, 0);

  /* ── Luces (paleta de marca) ── */
  scene.add(new THREE.AmbientLight(0xbfd0ff, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rimCyan = new THREE.PointLight(0x4cc3f7, 7, 12);
  rimCyan.position.set(-2.6, 1.6, 2.2);
  scene.add(rimCyan);
  const rimViolet = new THREE.PointLight(0x8b5cf6, 9, 12);
  rimViolet.position.set(2.6, 2.4, -2.4);
  scene.add(rimViolet);

  /* ── Sombra falsa (gradiente radial, sin shadow map) ── */
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext("2d");
  const grad = sctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,10,0.55)");
  grad.addColorStop(1, "rgba(0,0,10,0)");
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.001;
  scene.add(shadow);

  /* ── Robot (sentado sobre el logo infinito, todo en el modelo) ── */
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync("assets/robot.glb");
  const robot = gltf.scene;

  // Escalar, rotar de frente y recién después centrar
  let box = new THREE.Box3().setFromObject(robot);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = 2.1 / size.y;
  robot.scale.setScalar(scale);
  robot.rotation.y = FACE_FRONT;
  box = new THREE.Box3().setFromObject(robot);
  robot.position.x -= (box.min.x + box.max.x) / 2;
  robot.position.z -= (box.min.z + box.max.z) / 2;
  robot.position.y -= box.min.y;
  scene.add(robot);

  /* Altura de apoyo: base de la flotación. El modelo entero sube y baja
     desde acá, logo infinito incluido. */
  const FLOAT_BASE_Y = robot.position.y;

  const parentNode = robot.getObjectByName("ParentNode") || robot;

  /* Pivote genérico: crea un Group en un punto del modelo y le
     cuelga piezas preservando su posición mundial */
  function makePivot(point, partNames) {
    const pivot = new THREE.Group();
    pivot.position.set(point.x, point.y, point.z);
    parentNode.add(pivot);
    partNames.forEach((name) => {
      const part = robot.getObjectByName(name);
      if (part) pivot.attach(part);
    });
    return pivot;
  }

  const headPivot = makePivot(NECK, HEAD_PARTS);
  const armPivot = makePivot(SHOULDER, ARM_PARTS);

  /* Ojos reales del modelo: parpadean contrayéndose y volviendo.
     Detrás de cada ojo hay un zócalo BLANCO pintado en el visor que
     queda expuesto al achicarse el ojo → lo tapamos con un disco
     oscuro color visor; así el ojo se contrae sobre fondo negro. */
  const eyes = EYE_PARTS.map((n) => robot.getObjectByName(n)).filter(Boolean);
  const eyeBase = eyes.map((e) => ({ y: e.scale.y, z: e.scale.z }));
  const backingGeo = new THREE.CircleGeometry(0.078, 24);
  const backingMat = new THREE.MeshBasicMaterial({ color: 0x05060d });
  [0.09, -0.09].forEach((z) => {
    const disk = new THREE.Mesh(backingGeo, backingMat);
    // local al pivote del cuello; la cara mira +X
    disk.position.set(0.148, 0.14, z);
    disk.rotation.y = Math.PI / 2;
    headPivot.add(disk);
  });
  function setEyeLid(lid) {
    // lid 1 = abierto, 0.12 = contraído
    eyes.forEach((e, i) => {
      e.scale.y = eyeBase[i].y * lid;
      e.scale.z = eyeBase[i].z * (0.55 + 0.45 * lid); // contrae también a lo ancho, menos
    });
  }

  /* ── Interacción: solo la cabeza ── */
  const MAX_YAW = THREE.MathUtils.degToRad(30);
  const MAX_PITCH = THREE.MathUtils.degToRad(16);
  let targetYaw = 0;
  let targetPitch = 0;

  if (canHover) {
    window.addEventListener(
      "pointermove",
      (e) => {
        targetYaw = ((e.clientX / window.innerWidth) * 2 - 1) * MAX_YAW;
        targetPitch = ((e.clientY / window.innerHeight) * 2 - 1) * MAX_PITCH;
      },
      { passive: true }
    );
  }

  /* ── Estado de parpadeo y saludo ── */
  const BLINK_DUR = 0.22; // contracción + retorno
  let blinkAt = 2.2;
  let blinkStart = -1;

  const WAVE_PERIOD = 20; // segundos entre saludos
  const WAVE_RAISE = 0.55, WAVE_HOLD = 1.5, WAVE_LOWER = 0.55;
  const WAVE_TOTAL = WAVE_RAISE + WAVE_HOLD + WAVE_LOWER;
  const WAVE_UP = 1.45; // rad (~83°): brazo al costado, arriba de horizontal, sin que lo tape la cabeza
  let waveAt = params.has("wave") ? 1.5 : 4; // primer saludo a los 4s (bienvenida)
  let waveStart = -1;
  const waveHold = params.has("wavehold"); // debug: brazo arriba congelado

  /* ── Flotación idle ──
     Dos senos de período distinto (4.2s y 6.7s, no múltiplos) para que el
     ciclo no se sienta mecánico: nunca repite exactamente el mismo recorrido.
     Amplitud en unidades del modelo, que mide 2.1 de alto → ~4% de su altura
     de punta a punta, suficiente para leerse como flotar sin que parezca que
     salta. El recorrido se desplaza entero HACIA ARRIBA (ver FLOAT_LIFT): si
     bajara de su altura de apoyo, la base del logo se hundiría por debajo del
     plano de la sombra y se vería cortada.
     La sombra acompaña: se achica y se aclara cuando el robot sube. */
  const FLOAT_AMP = 0.034;
  const FLOAT_AMP_2 = 0.011;
  const FLOAT_LIFT = FLOAT_AMP + FLOAT_AMP_2; // piso de la flotación = altura de apoyo
  const FLOAT_TILT = 0.012; // rad, balanceo lateral apenas perceptible
  const shadowBaseScale = shadow.scale.x;

  const ease = (x) => x * x * (3 - 2 * x); // smoothstep

  /* ── Loop: solo corre con el hero visible y la pestaña activa ── */
  let visible = true;
  let rafId = 0;
  const clock = new THREE.Clock();

  function frame() {
    rafId = 0;
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();

    if (!canHover) {
      targetYaw = Math.sin(t * 0.45) * MAX_YAW * 0.75;
      targetPitch = Math.sin(t * 0.3) * MAX_PITCH * 0.4;
    }

    /* Flotación: el modelo entero sube y baja por encima de su altura de apoyo */
    const wave =
      Math.sin((t / 4.2) * Math.PI * 2) * FLOAT_AMP +
      Math.sin((t / 6.7) * Math.PI * 2) * FLOAT_AMP_2;
    const floatY = FLOAT_LIFT + wave; // 0 … 2·FLOAT_LIFT, nunca negativo
    robot.position.y = FLOAT_BASE_Y + floatY;
    robot.rotation.z = Math.sin((t / 5.5) * Math.PI * 2) * FLOAT_TILT;

    // La sombra delata la altura: más chica y más tenue cuanto más alto está
    const lift = floatY / (2 * FLOAT_LIFT); // 0 … 1
    shadow.scale.setScalar(shadowBaseScale * (1 - lift * 0.14));
    shadow.material.opacity = 1 - lift * 0.28;

    /* Cabeza mira al mouse; cuerpo quieto. Cara mira +X en local:
       yaw = rotación Y, pitch = rotación Z (negativo = mirar abajo) */
    headPivot.rotation.y += (targetYaw - headPivot.rotation.y) * 0.1;
    headPivot.rotation.z += (-targetPitch - headPivot.rotation.z) * 0.1;

    // Idle de cabeza: micro-balanceo + respiración sutil
    headPivot.rotation.x = Math.sin(t * 0.9) * 0.02;
    headPivot.position.y = NECK.y + Math.sin(t * 1.4) * 0.008;

    // Parpadeo: contracción suave y vuelta
    if (params.has("blinkhold")) {
      setEyeLid(0.12); // debug: ojos contraídos
    } else {
      if (blinkStart < 0 && t >= blinkAt) blinkStart = t;
      if (blinkStart >= 0) {
        const bp = (t - blinkStart) / BLINK_DUR;
        if (bp >= 1) {
          setEyeLid(1);
          blinkStart = -1;
          blinkAt = t + (Math.random() < 0.2 ? 0.25 : 2.5 + Math.random() * 3.5);
        } else {
          setEyeLid(1 - Math.sin(Math.PI * bp) * 0.88);
        }
      }
    }

    // Saludo: levanta el brazo, agita 3 veces, baja
    if (waveHold) {
      armPivot.rotation.x = WAVE_UP;
    } else {
      if (waveStart < 0 && t >= waveAt) waveStart = t;
      if (waveStart >= 0) {
        const wt = t - waveStart;
        if (wt >= WAVE_TOTAL) {
          armPivot.rotation.x = 0;
          waveStart = -1;
          waveAt = t + WAVE_PERIOD; // luego, exacto cada 20s
        } else if (wt < WAVE_RAISE) {
          armPivot.rotation.x = WAVE_UP * ease(wt / WAVE_RAISE);
        } else if (wt < WAVE_RAISE + WAVE_HOLD) {
          const ht = wt - WAVE_RAISE;
          armPivot.rotation.x = WAVE_UP + Math.sin((ht / WAVE_HOLD) * Math.PI * 6) * 0.22;
        } else {
          const lt = (wt - WAVE_RAISE - WAVE_HOLD) / WAVE_LOWER;
          armPivot.rotation.x = WAVE_UP * (1 - ease(lt));
        }
      }
    }

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(frame);
  }
  const wake = () => { if (!rafId) rafId = requestAnimationFrame(frame); };

  if (reducedMotion) {
    renderer.render(scene, camera); // un frame estático, sin loop
  } else {
    new IntersectionObserver(
      ([e]) => { visible = e.isIntersecting; if (visible) wake(); },
      { threshold: 0.05 }
    ).observe(container);
    document.addEventListener("visibilitychange", wake);
    wake();
  }

  /* ── Resize ── */
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const w = container.clientWidth, h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (reducedMotion) renderer.render(scene, camera);
    }, 150);
  });

  /* Debug: ?floatdebug expone la altura del robot para poder medir la
     flotación desde afuera (verificación automatizada). Sin el flag no se
     escribe nada, así que no cuesta nada en producción. */
  if (params.has("floatdebug")) {
    Object.defineProperty(window, "__robotY", { get: () => robot.position.y });
    // Desplazamiento respecto de la altura de apoyo: debe quedar siempre ≥ 0
    Object.defineProperty(window, "__robotFloat", { get: () => robot.position.y - FLOAT_BASE_Y });
  }

  container.classList.add("is-ready");
}

/* Arranque diferido: después de load + momento ocioso */
function deferredStart() {
  const go = () => init().catch(() => {});
  if ("requestIdleCallback" in window) requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 600);
}
if (document.readyState === "complete") deferredStart();
else window.addEventListener("load", deferredStart);
