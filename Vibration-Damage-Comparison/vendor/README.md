# Offline presentation runtime

`pptxgen.bundle.js` is the unmodified PptxGenJS 4.0.1 browser distribution from the installed `pptxgenjs` package (`dist/pptxgen.bundle.js`). Upstream: https://github.com/gitbrent/PptxGenJS . It is MIT licensed; see `PptxGenJS-LICENSE`.

The bundle includes JSZip and its dependency notices. JSZip is available under MIT or GPLv3; this project uses the MIT option. See `JSZip-LICENSE.markdown`. Keep upstream license comments intact.

`build.mjs` embeds this runtime into the downloadable HTML and removes only its source-map comment, so exports require no server, CDN, account, or network access. Its browser constructor is `PptxGenJS`. Runtime upgrades should be deliberate and must pass the collection and PowerPoint tests.
