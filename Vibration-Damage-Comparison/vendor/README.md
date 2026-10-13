# Offline presentation runtime

## Workbench plotting and Excel import

The experimental workbench also embeds these pinned, unmodified browser distributions (no CDN calls at runtime):

| Library | Source | License | SHA256 |
|---|---|---|---|
| Plotly.js 4.1.1 | [Distribution](https://cdn.plot.ly/plotly-4.1.1.min.js) | MIT, `plotly-LICENSE` | `3b6e15d45dbb7fca5bd2094291e961ddc5472cd887009e6009a56dab668d721f` |
| SheetJS CE 0.20.3 | [Distribution](https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js) | Apache 2.0, `sheetjs-LICENSE` | `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41` |

Plotly provides interaction and chart export; SheetJS reads literal input values from the template. The template itself is authored with the development-only artifact runtime. Builds preserve license headers and escape HTML script endings for safe embedding.

`pptxgen.bundle.js` is the unmodified PptxGenJS 4.0.1 browser distribution from the installed `pptxgenjs` package (`dist/pptxgen.bundle.js`). Upstream: https://github.com/gitbrent/PptxGenJS . It is MIT licensed; see `PptxGenJS-LICENSE`.

The bundle includes JSZip and its dependency notices. JSZip is available under MIT or GPLv3; this project uses the MIT option. See `JSZip-LICENSE.markdown`. Keep upstream license comments intact.

`build.mjs` embeds this runtime into the downloadable HTML and removes only its source-map comment, so exports require no server, CDN, account, or network access. Its browser constructor is `PptxGenJS`. Runtime upgrades should be deliberate and must pass the collection and PowerPoint tests.
