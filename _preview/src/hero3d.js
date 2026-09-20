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

/* 環境は画像を持たず、キャンバス相当のデータから作る。
   漆の艶は「窓が映り込んでいる」形なので、環境をのっぺりさせると
   ハイライトが広がってプラスチックに見える。
   明るい帯を1本だけ通し、上下は落とす。 */
function makeEnv(renderer) {
  const w = 64, h = 128, data = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    // 天頂side=0。0.18〜0.30 のあたりに窓の帯を置く
    const band = Math.exp(-Math.pow((v - 0.235) / 0.040, 2));
    const sky  = Math.pow(1 - v, 2.6) * 0.45;
    const floor = Math.pow(v, 3.0) * 0.10;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // 横方向にも少し濃淡をつけ、面が動いたときに艶が流れるようにする
      const side = 0.82 + 0.18 * Math.cos(x / w * Math.PI * 2);
      const e = (band * 2.15 + sky) * side + floor;
      data[i]     = e * 1.00;
      data[i + 1] = e * 0.86;
      data[i + 2] = e * 0.74;
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
  renderer.toneMappingExposure = 1.0;

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

  /* 漆。地は沈んだ赤茶で、光が当たったところだけ赤が出る。
     上塗りの艶は clearcoatRoughness を詰めて細く鋭くする。
     ここを 0.12 にしていたときはハイライトが広がって
     プラスチックに見えていた。 */
  const material = new MeshPhysicalMaterial({
    color: new Color(opts.color || '#5e1c0e'),
    roughness: 0.52,          // 地はやや粗く。艶は上塗りが持つ
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.045,
    ior: 1.5,
    specularIntensity: 0.9,
    sheen: 0.22,
    sheenColor: new Color('#c2401f'),
    sheenRoughness: 0.6,
    envMapIntensity: 1.05,
  });

  const mesh = new Mesh(gGear, material);
  const pivot = new Group();
  pivot.add(mesh);
  scene.add(pivot);

  /* 暗い地から立体を起こす。鍵光は絞り、縁を拾う光で輪郭を出す。
     環境光を上げすぎると全体が持ち上がって漆の深さが消える */
  const key = new DirectionalLight(0xfff2e6, 2.1); key.position.set(-210, 260, 300); scene.add(key);
  const rim = new DirectionalLight(0xff8f55, 2.6); rim.position.set(300, -90, -260); scene.add(rim);
  const fill = new DirectionalLight(0xffd9c0, 0.5); fill.position.set(120, -220, 240); scene.add(fill);
  scene.add(new AmbientLight(0xffe4d2, 0.16));

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

    /* 正面を向けすぎると、面の法線がどこも同じになって
       環境の同じ場所ばかり映り、艶が動かない。
       傾けておくと、咲くにつれて艶が面を流れる */
    pivot.rotation.z = -bloom * 0.62;
    pivot.rotation.y = -0.22 + Math.sin(bloom * Math.PI) * 0.26;
    pivot.rotation.x = -0.25 + bloom * 0.16;
    pivot.scale.setScalar(1 + bloom * 0.06);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  resize();
  addEventListener('resize', resize, { passive: true });
  requestAnimationFrame(frame);
  return { setBloom, resize };
}
