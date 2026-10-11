"""Build the method paper from Markdown. Dependencies: reportlab, matplotlib, pillow.
The standalone browser tool does not need this authoring script or dependencies.
"""
from pathlib import Path
import json, subprocess, re, html, argparse
parser=argparse.ArgumentParser()
parser.add_argument("--source",default="WHITE_PAPER.md")
parser.add_argument("--output",default="Vibration_Damage_Comparison_White_Paper.pdf")
parser.add_argument("--audit",action="store_true")
args=parser.parse_args()
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from PIL import Image as PILImage
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT

root=Path(__file__).resolve().parent
build=root/'_paper_build';build.mkdir(exist_ok=True)
assets=root/'paper-assets';assets.mkdir(exist_ok=True)
data=json.loads(subprocess.check_output(['node','-e',"const V=require('./engine.js');console.log(JSON.stringify(V.analyze(V.parse(require('./example-case.json').inputs))));"],cwd=root))
plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
fig,ax=plt.subplots(figsize=(8.2,2.85))
f=[x['fn'] for x in data['rows']]
ax.loglog(f,[x['heritage']/x['dirlik'] for x in data['rows']],color='#087f83',lw=2,label='Heritage / random (Dirlik)')
ax.loglog(f,[x['heritage']/x['nb'] for x in data['rows']],color='#c86327',lw=1.5,ls='--',label='Narrowband cross-check')
ax.axhline(1,color='#a93636',lw=1,ls=':')
ax.set(xlabel='Natural frequency (Hz)',ylabel='Damage ratio',xlim=(5,2000))
ax.grid(True,which='major',alpha=.15);ax.legend(loc='lower left',fontsize=8,frameon=False)
fig.tight_layout();fig.savefig(assets/'example_coverage.png',dpi=200);plt.close(fig)
from matplotlib.font_manager import findfont, FontProperties
for name,weight,style in [('DVS','normal','normal'),('DVS-B','bold','normal'),('DVS-I','normal','oblique')]:pdfmetrics.registerFont(TTFont(name,findfont(FontProperties(family='DejaVu Sans',weight=weight,style=style))))
pdfmetrics.registerFontFamily('DVS',normal='DVS',bold='DVS-B',italic='DVS-I',boldItalic='DVS-B')
ss=getSampleStyleSheet()
ss.add(ParagraphStyle(name='BodyV',fontName='DVS',fontSize=9.1,leading=13.5,textColor=colors.HexColor('#203849'),spaceAfter=9))
ss.add(ParagraphStyle(name='TitleV',fontName='DVS-B',fontSize=25,leading=29,textColor=colors.HexColor('#12344c'),spaceAfter=13))
ss.add(ParagraphStyle(name='H2V',fontName='DVS-B',fontSize=17,leading=21,textColor=colors.HexColor('#12344c'),spaceAfter=12,keepWithNext=True))
ss.add(ParagraphStyle(name='H3V',fontName='DVS-B',fontSize=10.7,leading=14,textColor=colors.HexColor('#087f83'),spaceBefore=7,spaceAfter=6,keepWithNext=True))
ss.add(ParagraphStyle(name='TableV',fontName='DVS',fontSize=8,leading=11,textColor=colors.HexColor('#203849')))
ss.add(ParagraphStyle(name='TableH',parent=ss['TableV'],fontName='DVS-B',textColor=colors.white))
if args.audit:
    ss['BodyV'].leading=12.5
    ss['BodyV'].spaceAfter=7
    ss['TableV'].leading=10
    ss['TableH'].leading=10
    ss['H3V'].spaceBefore=5
PAD=6 if args.audit else 8
WIDTH=484
def p(t,sty='BodyV'):
    t=html.escape(t)
    t=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',t)
    return Paragraph(t,ss[sty])
eqnum=0
def eq(t):
    global eqnum
    eqnum+=1
    fig=plt.figure(figsize=(12,1));fig.patch.set_alpha(0)
    text=fig.text(.01,.5,'$'+t+'$',fontsize=15,color='#12344c',va='center')
    fig.canvas.draw();box=text.get_window_extent(fig.canvas.get_renderer()).expanded(1.03,1.28)
    fp=build/f'eq_{eqnum:02}.png';fig.savefig(fp,dpi=240,bbox_inches=box.transformed(fig.dpi_scale_trans.inverted()),transparent=True);plt.close(fig)
    im=PILImage.open(fp);w,h=im.size;ww=min(WIDTH,w/240*72);hh=ww*h/w
    return [Image(str(fp),width=ww,height=hh,hAlign='LEFT'),Spacer(1,9)]
def table(lines):
    rows=[[x.strip() for x in l.strip().strip('|').split('|')] for l in lines]
    rows=[r for r in rows if not all(re.fullmatch(r'[-: ]+',x) for x in r)]
    n=len(rows[0]);widths=([125,170,189] if n==3 else [152,332] if n==2 else [WIDTH/n]*n)
    cells=[[p(x,'TableH' if i==0 else 'TableV') for x in row] for i,row in enumerate(rows)]
    t=Table(cells,colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#12344c')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#f0f5f7'),colors.white]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),PAD),('BOTTOMPADDING',(0,0),(-1,-1),PAD),('LINEBELOW',(0,0),(-1,-1),.3,colors.HexColor('#d2dfe5'))]))
    return[t,Spacer(1,12)]
story=[];lines=(root/args.source).read_text().splitlines();i=0
while i<len(lines):
    line=lines[i].strip();i+=1
    if not line:continue
    if line=='@@page':story.append(PageBreak());continue
    if line.startswith('$$'):story.extend(eq(line[2:-2]));continue
    if line.startswith('!['):
        fp=root/re.search(r'\]\((.+)\)',line).group(1);im=PILImage.open(fp);w,h=im.size;story.extend([Image(str(fp),width=WIDTH,height=WIDTH*h/w),Spacer(1,9)]);continue
    if line.startswith('|'):
        group=[line]
        while i<len(lines) and lines[i].strip().startswith('|'):group.append(lines[i].strip());i+=1
        story.extend(table(group));continue
    if line.startswith('# '):story.append(p(line[2:],'TitleV'));continue
    if line.startswith('## '):story.append(p(line[3:],'H2V'));continue
    if line.startswith('### '):story.append(p(line[4:],'H3V'));continue
    while i<len(lines) and lines[i].strip() and not lines[i].startswith(('#','$$','|','@@','![')):line+=' '+lines[i].strip();i+=1
    story.append(p(line))
def page(canvas,doc):
    canvas.setStrokeColor(colors.HexColor('#d2dfe5'));canvas.setLineWidth(.6);canvas.line(54,746,558,746)
    canvas.setFont('DVS',7.5);canvas.setFillColor(colors.HexColor('#536b7a'));canvas.drawString(54,759,'USEFUL TOOLS  /  TECHNICAL AUDIT' if args.audit else 'USEFUL TOOLS  /  TECHNICAL WHITE PAPER');canvas.drawRightString(558,759,'VIBRATION DAMAGE COMPARISON 1.0.2')
    canvas.line(54,42,558,42);canvas.drawString(54,29,'Heritage sine qualification / random vibration requirements');canvas.drawRightString(558,29,f'{doc.page}')
doc=SimpleDocTemplate(str(root/args.output),pagesize=(612,792),rightMargin=64,leftMargin=64,topMargin=61,bottomMargin=58,title='Vibration Damage Comparison - Technical Audit' if args.audit else 'Comparing heritage sine qualification with random vibration requirements',author='Useful Tools',subject='Response-based fatigue severity method, equations, assumptions and verification')
doc.build(story,onFirstPage=page,onLaterPages=page)
print(root/args.output)
