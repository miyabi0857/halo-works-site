# tools

- `make-mark-states.py` … ロゴマーク（歯車→花）の中間状態を作る。
  `_preview` 時代の3D版もここの計算を移植している（`js/hero3d-src/`）
- `check-pages.js` … 全ページをPC・スマホで開き、横溢れ・404・JSエラー・
  低コントラスト・画面内で隠れたままの要素を機械的に調べる。
  Playwright が要る。ローカルで `python3 -m http.server 8765` を
  立ててから `node tools/check-pages.js`

## 3Dヒーローの束ね直し

`js/hero3d-src/` を変更したら束ね直す。

```
npx esbuild js/hero3d-src/hero3d.js --bundle --minify --format=esm \
  --loader:.json=json --outfile=js/hero3d.bundle.js
```

three.js は CDN ではなくこのリポジトリに自前で同梱する方針
（維持費ゼロ・更新の手間なしという売りと、他社CDN依存が矛盾するため）。
