"""Extract Fig. 53's red predicted SPL curve, not blue SSDL or measured circles.

Requires the unmodified Auburn dissertation in research/smith2013.pdf.
Calibration is in the embedded 478 x 368 image's pixel coordinates.
No model results enter the digitization. See reference/PUBLISHED_CASE.md.
"""
from pathlib import Path
import hashlib, json, math
import pymupdf
import numpy as np

R = Path(__file__).resolve().parent
pdf = R / 'research/smith2013.pdf'
doc = pymupdf.open(pdf)
page = doc[78]
image = page.get_images(full=True)[0]
pix = pymupdf.Pixmap(doc, image[0])
assert (pix.width, pix.height) == (478, 368)
rgb = np.frombuffer(pix.samples, np.uint8).reshape(368, 478, pix.n)[:, :, :3].astype(int)
mask = (rgb[:, :, 0] > 150) & (rgb[:, :, 0] - rgb[:, :, 1] > 70) & (rgb[:, :, 0] - rgb[:, :, 2] > 70)
samples = []
for k in range(-10, 11):
    f = 1000 * 10 ** (k / 10)
    x = 47.5 + (403.5 - 47.5) * (math.log10(f) - 1) / 3
    # Interpolate bracketing stroke centers, bridging small occlusions by markers.
    def stroke(col):
        rows = np.flatnonzero(mask[38:327, col]) + 38
        return float(np.median(rows)) if len(rows) else None
    left, right = math.floor(x), math.ceil(x)
    while stroke(left) is None: left -= 1
    while stroke(right) is None: right += 1
    assert x-left <= 5 and right-x <= 5, (f, left, right)
    y = stroke(left) if left == right else stroke(left)+(x-left)/(right-left)*(stroke(right)-stroke(left))
    level = 120 - (y-37.5) * 80 / (327.5-37.5)
    samples.append({'frequency': f, 'level': round(level, 3), 'pixelX': x, 'pixelY': y,
                    'bracketingColumns': [left, right]})

url = 'https://auetd.auburn.edu/handle/10415/3954'
data = {'id': 'smith2013-figure53', 'title': 'Smith (2013) · free jet · 45° receiver',
        'source': url, 'figure': 'Figure 53, printed p. 63 / PDF p. 79',
        'sourceSha256': hashlib.sha256(pdf.read_bytes()).hexdigest(),
        'curve': 'Red SPL Prediction curve; published DSM-II variant, not measurements or blue SSDL',
        'readingPrecisionDb': 0.5,
        'frequencyBasis': 'Published base-2 third-octave curve sampled at workbench base-10 centers; approximate interpolation, not exact band-energy rebinning.',
        'readingNote': 'Estimated graph-reading precision only, not experimental or model uncertainty.',
        'calibration': {'imageSize': [478, 368], 'x10Hz': 47.5, 'x10000Hz': 403.5,
                        'y120dB': 37.5, 'y40dB': 327.5}, 'samples': samples}
(R/'reference/smith2013-spectrum.json').write_text(json.dumps(data, indent=2)+'\n', encoding='utf-8')
# A single figure excerpt, including axes and legend, for visual checking.
rect = page.get_image_rects(image[0])[0]
page.get_pixmap(matrix=pymupdf.Matrix(2,2), clip=rect).save(R/'figures/smith2013-figure53.png')
provenance = R/'figures/provenance.json'
entries = json.loads(provenance.read_text(encoding='utf-8'))
entries = [e for e in entries if e['file'] != 'smith2013-figure53.png']
entries.append({'file':'smith2013-figure53.png','source':'smith2013.pdf','source_url':url,
                'figure':'Figure 53','printed_page':'63','pdf_page':79,
                'crop_pdf_points':list(rect),'render_scale':2,
                'processing':'Original plot excerpt with axes and legend; no curve alterations. Attribution outside crop.',
                'source_sha256':data['sourceSha256'],
                'rights':'Copyright 2013 Wesley Oliver Smith III. Limited excerpt for technical comparison; no endorsement.'})
provenance.write_text(json.dumps(entries,indent=2)+'\n',encoding='utf-8')
print('Extracted 21 independent graph readings and one attributed figure excerpt.')
