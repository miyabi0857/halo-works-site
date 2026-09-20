/* ============================================================
   マークの立体。頂点の順番まで決め打ちで組む。

   経緯（同じ失敗を繰り返さないために残す）
   1. ExtrudeGeometry に3状態を作らせてモーフ → 破綻。
      頂点の「数」は揃っても三角形分割の「順番」が形ごとに変わる
   2. 中心から全部見える星型とみなして穴と外輪を帯で繋いだ → 中心に筋。
      花びらは30度反るので、中心から見て輪郭が二重になる角度がある
   3. ハブと歯に分けたが、ハブの外周を閉じ忘れて歯が浮いた

   4. 今の作り：ハブと歯9枚を、それぞれ閉じた立体として作り、
      歯の根元をハブに1.5だけ埋める。不透明なので重なった中は見えない。
      継ぎ目を気にせず、どちらも単純な筒として扱える。
   ============================================================ */
import { BufferGeometry, BufferAttribute } from 'three';
import MARK from './mark-data.json';

const SEG = 64;      // 歯1枚の輪郭の標本点
const HUB = 128;     // ハブの分割
const DEPTH = 13;
const BEVEL = 1.5;
const CX = 80;
const HOLE_R = 13;
const ROOT_R = 36;
const SINK = 1.5;    // 歯の根元をハブへ埋める量

const Z0 = 0, Z1 = BEVEL, Z2 = DEPTH - BEVEL, Z3 = DEPTH;

const qbez = (p0, p1, p2, t) => {
  const m = 1 - t;
  return [m * m * p0[0] + 2 * m * t * p1[0] + t * t * p2[0],
          m * m * p0[1] + 2 * m * t * p1[1] + t * t * p2[1]];
};
const polar = (deg, r) => [CX + r * Math.cos(deg * Math.PI / 180),
                           -(CX + r * Math.sin(deg * Math.PI / 180))];

function tooth(b, k) {
  const gear = MARK.gear, logo = MARK.logo[k], flower = MARK.flower;
  const [s, d, u] = b <= 0.5 ? [gear, logo, b / 0.5] : [logo, flower, (b - 0.5) / 0.5];
  const base = MARK.base0 + MARK.step * k, p = [];
  for (let i = 0; i < 8; i++) {
    const a = s[i][0] + (d[i][0] - s[i][0]) * u;
    const r = s[i][1] + (d[i][1] - s[i][1]) * u;
    p.push(polar(base + a, r));
  }
  const arcs = [[p[0],p[1],p[2]],[p[2],p[3],p[4]],[p[4],p[5],p[6]],[p[6],p[7],p[7]]];
  const per = SEG / 4, edge = [];
  for (let a = 0; a < 4; a++) for (let i = 0; i < per; i++) edge.push(qbez(arcs[a][0],arcs[a][1],arcs[a][2], i/per));
  edge.push(p[7]);
  const root = [];
  for (let i = 0; i <= SEG; i++) root.push(polar(base + MARK.step * (i / SEG), ROOT_R - SINK));
  // 輪郭を根元へ向けて BEVEL だけ縮めた版（面取り用）
  const edgeIn = edge.map((e, i) => {
    const r = root[i], dx = e[0]-r[0], dy = e[1]-r[1], L = Math.hypot(dx,dy);
    return L < BEVEL*2 ? [e[0],e[1]] : [e[0]-dx/L*BEVEL, e[1]-dy/L*BEVEL];
  });
  return { edge, edgeIn, root };
}

function hubRings() {
  const hole=[], holeIn=[], out=[], outIn=[];
  for (let i = 0; i <= HUB; i++) {
    const a = i / HUB * 360;
    hole.push(polar(a, HOLE_R));
    holeIn.push(polar(a, HOLE_R + BEVEL));
    out.push(polar(a, ROOT_R));
    outIn.push(polar(a, ROOT_R - BEVEL));
  }
  return { hole, holeIn, out, outIn };
}

const HUBN = HUB + 1, TN = SEG + 1;
const HUB_STRIPS = 8, TOOTH_STRIPS = 6;
export const VERTS = HUB_STRIPS * 2 * HUBN + 9 * (TOOTH_STRIPS * 2 * TN);

export function positions(b) {
  const H = hubRings();
  const arr = new Float32Array(VERTS * 3);
  let w = 0;
  const put = (pts, z) => { for (const p of pts) { arr[w++]=p[0]-CX; arr[w++]=p[1]+CX; arr[w++]=z-DEPTH/2; } };

  /* ハブ：閉じた輪。外周 → 前面 → 穴の内壁 → 背面 と一周する */
  const hub = [
    [H.outIn, Z0, H.out, Z1],      // 背の外面取り
    [H.out,   Z1, H.out, Z2],      // 外周の壁
    [H.out,   Z2, H.outIn, Z3],    // 前の外面取り
    [H.outIn, Z3, H.holeIn, Z3],   // 前面
    [H.holeIn,Z3, H.hole, Z2],     // 前の穴面取り
    [H.hole,  Z2, H.hole, Z1],     // 穴の内壁
    [H.hole,  Z1, H.holeIn, Z0],   // 背の穴面取り
    [H.holeIn,Z0, H.outIn, Z0],    // 背面
  ];
  for (const [a,za,c,zc] of hub) { put(a,za); put(c,zc); }

  for (let k = 0; k < 9; k++) {
    const t = tooth(b, k);
    const st = [
      [t.edgeIn, Z0, t.edge,  Z1],   // 背の面取り
      [t.edge,   Z1, t.edge,  Z2],   // 外の壁
      [t.edge,   Z2, t.edgeIn,Z3],   // 前の面取り
      [t.edgeIn, Z3, t.root,  Z3],   // 前面（帽子）
      [t.root,   Z3, t.root,  Z0],   // 根元の壁（ハブに埋まって見えない）
      [t.root,   Z0, t.edgeIn,Z0],   // 背面（帽子）
    ];
    for (const [a,za,c,zc] of st) { put(a,za); put(c,zc); }
  }
  return arr;
}

export function buildGeometry() {
  const idx = [];
  let base = 0;
  const strip = (count) => {
    const A = base, B = base + count;
    for (let i = 0; i < count - 1; i++) {
      idx.push(A + i, B + i, B + i + 1, A + i, B + i + 1, A + i + 1);
    }
    base += count * 2;
  };
  for (let s = 0; s < HUB_STRIPS; s++) strip(HUBN);
  for (let k = 0; k < 9; k++) for (let s = 0; s < TOOTH_STRIPS; s++) strip(TN);

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions(0), 3));
  g.setIndex(idx);
  return g;
}
