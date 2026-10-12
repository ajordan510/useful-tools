"""Extract measured and author ground-corrected spectra from Fukuda et al. (2011).
Reads vector marker positions, checked against their connecting polylines; independent of solver.
"""
import json,hashlib
from pathlib import Path
import pymupdf
R=Path(__file__).resolve().parent
source=R/'research/tsutsumi2011.pdf'
doc=pymupdf.open(source);p=doc[8];draw=p.get_drawings()
nominal=[125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000]
cases=[]
for receiver,frame,line_ids,starts,top,bottom in [('M1',30,[31,51,71],[32,52,72],138,102),('M8',129,[130,150,170],[131,151,171],150,114)]:
 rect=draw[frame]['rect'];series={};provenance={}
 for label,line,start in zip(['measured','corrected5000','corrected200000'],line_ids,starts):
  pts=[pt for item in draw[line]['items'] if item[0]=='l' for pt in item[1:]]
  vals=[];coords=[]
  for i in range(19):
   marker=draw[start+i]['rect'];mx=(marker.x0+marker.x1)/2
   point=min(pts,key=lambda v:abs(v.x-mx));assert abs(point.x-mx)<.6,(receiver,label,i,point,mx)
   level=top-(point.y-rect.y0)*(top-bottom)/rect.height
   vals.append(round(level,3));coords.append({'markerDrawing':start+i,'polylineDrawing':line,'pointPDF':[round(point.x,4),round(point.y,4)]})
  series[label]=vals;provenance[label]=coords
 cases.append({'receiver':receiver,'figure':17 if receiver=='M1' else 18,'calibration':{'framePDF':list(rect),'topDb':top,'bottomDb':bottom},'samples':[{'nominalHz':f,'frequency':1000*10**((i-9)/10),**{k:v[i] for k,v in series.items()}} for i,f in enumerate(nominal)],'vectorProvenance':provenance})
result={'source':'https://www.jstage.jst.go.jp/article/tjsass/54/184/54_184_120/_article','pdfUrl':'https://www.jstage.jst.go.jp/article/tjsass/54/184/54_184_120/_pdf','title':'Fukuda et al. (2011), An Acoustic Impedance Model for Evaluating the Ground Effect of Static-Firing Tests on a Rocket Motor','page':'Printed 128 / PDF 9; Figures 17 and 18','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'dataType':'Measured spectra plus author model-based ground corrections; not predicted SPL curves','readingPrecisionDb':.5,'bandConvention':'Nominal third-octave bands paired with workbench base-10 exact centers by band index. Original band implementation is unspecified; no measured-energy rebinning.','cases':cases}
(R/'reference/fukuda2011-measured.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
p.get_pixmap(matrix=pymupdf.Matrix(2.5,2.5),clip=pymupdf.Rect(45,70,552,210)).save(R/'figures/fukuda2011-measured.png')
print('Extracted',len(cases)*19*3,'independent values')
for c in cases:print(c['receiver'],c['samples'][:2])
