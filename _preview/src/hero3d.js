/* ============================================================
   歯車が回りながら花に変わる（3D）

   確定ロゴは「歯車が花に変わる途中の1フレーム」なので、
   歯車 / 確定ロゴ / 満開 の3状態を作り、three.js のモーフで繋ぐ。
   輪郭を歯1枚あたり72点で標本化しているため、どの状態でも
   頂点数が 34,176 で一致する（形に依らず三角形分割が決まる）。
   だから法線ごと正しく補間できる。

   素材は漆。要件定義に「弁柄＝日本の建具や漆器に使われてきた赤茶」
   とあるので、金属ではなく漆器の質感に寄せる。
   MeshPhysicalMaterial の clearcoat で上塗りの艶を出す。
   ============================================================ */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, BufferAttribute,
  MeshPhysicalMaterial, DirectionalLight, AmbientLight,
  Color, SRGBColorSpace, ACESFilmicToneMapping,
  PMREMGenerator, DataTexture, EquirectangularReflectionMapping,
  FloatType, RGBAFormat,
} from 'three';
import { buildGeometry, positions } from './mark-geometry.js';

/* 環境は画像を持たず、キャンバスの縦グラデーションから作る。
   漆の艶は面の映り込みで出るので、光源だけだと平たくなる。
   ファイルを足さずに映り込みを得るための手。 */
function makeEnv(renderer) {
  const w = 16, h = 64, data = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    // 上：暖かい明るさ／下：沈んだ赤茶。漆器を上から照らした部屋を想定
    const top = [1.35, 1.12, 0.92], bot = [0.10, 0.06, 0.05];
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) data[i + c] = bot[c] + (top[c] - bot[c]) * Math.pow(1 - t, 1.7);
      data[i + 3] = 1;
    }
  }
  const tex = new DataTexture(data, w, h, RGBAFormat, FloatType);
  tex.mapping = EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose(); tex.dispose();
  return env;
}

export function initHero3D(canvas, opts = {}) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.getContext()) return null;

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  scene.environment = makeEnv(renderer);

  const camera = new PerspectiveCamera(34, 1, 1, 3000);
  camera.position.set(0, 0, 430);

  /* 頂点の順番が決め打ちなので、位置だけ差し替えれば対応が崩れない。
     法線は各状態で計算し直し、モーフ側にも渡す */
  const geo = buildGeometry();
  function normalsFor(pos) {
    const tmp = geo.clone();
    tmp.setAttribute('position', new BufferAttribute(pos, 3));
    tmp.computeVertexNormals();
    const n = tmp.attributes.normal;
    tmp.dispose();
    return n;
  }
  const pGear = positions(0), pLogo = positions(0.5), pFlower = positions(1);
  geo.setAttribute('position', new BufferAttribute(pGear, 3));
  geo.setAttribute('normal', normalsFor(pGear));
  geo.morphAttributes.position = [
    new BufferAttribute(pLogo, 3), new BufferAttribute(pFlower, 3)
  ];
  geo.morphAttributes.normal = [normalsFor(pLogo), normalsFor(pFlower)];
  const gGear = geo;

  const material = new MeshPhysicalMaterial({
    color: new Color(opts.color || '#a5361b'),
    roughness: 0.28,
    metalness: 0.0,
    clearcoat: 1.0,        // 漆の上塗り
    clearcoatRoughness: 0.12,
    sheen: 0.35,
    sheenColor: new Color('#e2653f'),
    envMapIntensity: 1.15,
  });

  const mesh = new Mesh(gGear, material);
  const pivot = new Group();
  pivot.add(mesh);
  scene.add(pivot);

  const key = new DirectionalLight(0xfff0e2, 2.5); key.position.set(-180, 240, 320); scene.add(key);
  const rim = new DirectionalLight(0xff9d6b, 1.9); rim.position.set(260, -120, -220); scene.add(rim);
  scene.add(new AmbientLight(0xffe9d8, 0.35));

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 760 ? 44 : 34;
    camera.updateProjectionMatrix();
  }

  let bloom = 0, shown = 0, target = 0;
  function setBloom(v) { target = Math.max(0, Math.min(1, v)); }

  function frame() {
    shown += (target - shown) * 0.12;          // 追従を遅らせて、スクロールのガタつきを均す
    bloom = shown;
    const inf = mesh.morphTargetInfluences;
    if (bloom <= 0.5) { inf[0] = bloom / 0.5; inf[1] = 0; }
    else { const u = (bloom - 0.5) / 0.5; inf[0] = 1 - u; inf[1] = u; }

    pivot.rotation.z = -bloom * 0.62;
    pivot.rotation.y = Math.sin(bloom * Math.PI) * 0.30;   // 咲く途中だけ少し傾ける
    pivot.rotation.x = -0.16 + bloom * 0.10;
    const s = 1 + bloom * 0.06;
    pivot.scale.setScalar(s);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  resize();
  addEventListener('resize', resize, { passive: true });
  requestAnimationFrame(frame);
  return { setBloom, resize };
}
