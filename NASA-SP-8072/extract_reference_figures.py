"""Render bounded figure excerpts from the reviewed source PDFs; no retouching."""
import hashlib,json
from pathlib import Path
import pymupdf
root=Path(__file__).resolve().parent
out=root/'figures';out.mkdir(exist_ok=True)
specs=[
 ('sp8072-fig11','sp8072',21,[87,47,494,330],'Figure 11','13','19710023719'),
 ('sp8072-fig12','sp8072',21,[112,342,465,587],'Figure 12','13','19710023719'),
 ('sp8072-fig13','sp8072',22,[116,45,537,348],'Figure 13','14','19710023719'),
 ('sp8072-fig10','sp8072',20,[143,48,533,390],'Figure 10','12','19710023719'),
 ('haynes2009-fig6','haynes2009',11,[73,140,538,311],'Figure 6','7','20090023640'),
 ('haynes2009-fig7','haynes2009',11,[103,435,508,675],'Figure 7','7','20090023640')
]
manifest=[]
for name,pdf,page,box,figure,printed,citation in specs:
 path=root/'research'/f'{pdf}.pdf'
 with pymupdf.open(path) as doc:
  doc[page-1].get_pixmap(matrix=pymupdf.Matrix(2.5,2.5),clip=pymupdf.Rect(box),alpha=False).save(out/f'{name}.png')
 manifest.append({'file':name+'.png','source':pdf+'.pdf','source_url':f'https://ntrs.nasa.gov/citations/{citation}','figure':figure,'printed_page':printed,'pdf_page':page,'crop_pdf_points':box,'render_scale':2.5,'processing':'Page crop and rasterization only; original axes, curves and captions retained.','source_sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(out/'provenance.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
print('Rendered six source figures with page/crop provenance.')
