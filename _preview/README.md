# 確認用プレビュー

このフォルダは**B案ヒーローの確認用**で、本番のページではない。
`main` にマージするときは、中身を `index.html` と `css/style.css` へ取り込み、
このフォルダごと消すこと。

- `hero-3d.html` … B案ヒーロー・3D版（**こちらが本命**）
- `hero-b.html` … B案ヒーロー・平面版（最初に作ったもの。比較用に残す）
- `src/` … 3D版のソース。`hero3d.bundle.js` はここから esbuild で束ねる

  ```
  npx esbuild _preview/src/hero3d.js --bundle --minify --format=esm \
    --loader:.json=json --outfile=_preview/hero3d.bundle.js
  ```

  束ねた結果は 542KB（gzip 136KB）。CDNは使わずリポジトリに自前で置く方針
- `mark-morph.js` … 歯車→花の中間形をブラウザ側で作る。
  `tools/make-mark-states.py` と同じ計算で、b=0.5 で確定ロゴと完全一致する
- `gsap.min.js` / `SplitText.min.js` … 確認用にnpmから取ったもの。
  本番に載せるときも、CDNではなくリポジトリに自前で置く方針（制作ルール5）

`noindex, nofollow` を入れてあるが、`main` に載せない限り配信もされない。
