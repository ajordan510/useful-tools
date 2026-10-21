"""Render the action-comedy announcement from real tool captures and licensed B-roll.

Requires Python, Pillow, NumPy, imageio-ffmpeg. Run capture.cjs first.
Source media belong in ignored assets/. The finished MP4 is self-contained.
"""
import concurrent.futures, json, math, subprocess, wave, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/'assets'; CAP=ROOT/'captures'; RENDER=ROOT/'render'; RENDER.mkdir(exist_ok=True)
FF=imageio_ffmpeg.get_ffmpeg_exe()
W,H,FPS=1920,1080,24
TEAL='#70e4df'; ORANGE='#ffa34d'; WHITE='#f3f7f8'; MUTED='#a3b6c3'
FONT=Path('C:/Windows/Fonts/bahnschrift.ttf'); BOLD=Path('C:/Windows/Fonts/arialbd.ttf')
TOTAL=61.5
SPEED=.9
LEAD=1.0

def font(size,bold=False):return ImageFont.truetype(str(BOLD if bold else FONT),size)
def ff(args):
    p=subprocess.run([FF,'-hide_banner','-loglevel','error','-y',*map(str,args)],cwd=ROOT,capture_output=True)
    if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace'))
def text(im,xy,words,size=60,fill=WHITE,bold=False,anchor=None):
    ImageDraw.Draw(im).text(xy,words,font=font(size,bold),fill=fill,anchor=anchor,stroke_width=0)
def center(im,y,words,size=60,fill=WHITE,bold=False):text(im,(W//2,y),words,size,fill,bold,'mt')

def backdrop():
    yy,xx=np.mgrid[0:H,0:W]
    glow=np.exp(-(((xx-1480)/850)**2+((yy-330)/600)**2))
    warm=np.exp(-(((xx-170)/530)**2+((yy-830)/380)**2))
    a=np.zeros((H,W,3),np.uint8)
    for k,(base,gain,wgain) in enumerate([(6,6,24),(13,30,9),(22,36,0)]):a[:,:,k]=base+gain*glow+wgain*warm
    im=Image.fromarray(a);d=ImageDraw.Draw(im)
    for x in range(70,W,90):d.line((x,90,x,H-90),fill='#142936',width=1)
    for y in range(90,H-80,90):d.line((70,y,W-70,y),fill='#142936',width=1)
    d.rectangle((0,0,W,80),fill='#03070c');d.rectangle((0,974,W,H),fill='#03070c')
    return im
BG=backdrop()

def shell(kicker,headline,sub='',color=TEAL):
    im=BG.copy();d=ImageDraw.Draw(im)
    d.rectangle((92,108,100,139),fill=color)
    text(im,(118,110),kicker.upper(),25,color)
    text(im,(92,161),headline,62,WHITE,True)
    if sub:text(im,(94,245),sub,29,MUTED)
    text(im,(92,940),'SHOCK  /  PREDICTION WORKBENCH',20,TEAL)
    text(im,(1828,940),'TEAM RELEASE  /  01',20,MUTED,False,'rt')
    return im

def tool(kicker,headline,capture,sub='',crop=None,tag=None,color=TEAL):
    im=shell(kicker,headline,sub,color);src=Image.open(CAP/(capture+'.png')).convert('RGB')
    if crop:src=src.crop(crop)
    bound=(1736,590);scale=min(bound[0]/src.width,bound[1]/src.height)
    src=src.resize((round(src.width*scale),round(src.height*scale)),Image.Resampling.LANCZOS)
    x=(W-src.width)//2;y=302+(590-src.height)//2
    d=ImageDraw.Draw(im);d.rounded_rectangle((x-6,y-6,x+src.width+6,y+src.height+6),radius=12,outline=color,width=3)
    im.paste(src,(x,y))
    if tag:
        d=ImageDraw.Draw(im);box=d.textbbox((0,0),tag,font=font(23,True));tw=box[2]+34
        d.rounded_rectangle((W-94-tw,266,W-94,302),radius=7,fill='#123b40');text(im,(W-77-tw,271),tag,23,TEAL,True)
    text(im,(W//2,908),'REAL WORKBENCH CAPTURE  •  ILLUSTRATIVE INPUTS',20,MUTED,False,'mt')
    return im

def title(kicker,lines,footer='',accent=TEAL):
    im=BG.copy();center(im,190,kicker.upper(),26,accent)
    sizes=[126 if len(line)<17 else 82 for line in lines]
    top=335 if len(lines)<=2 else 290
    for i,(line,size) in enumerate(zip(lines,sizes)):center(im,top+i*155,line,size,WHITE if i==0 else accent,True)
    if footer:center(im,800,footer,32,MUTED)
    return im

def bolt_card():
    im=title('ENGINEERING PRESENTS',['ONE TINY BOLT.','ABSOLUTELY NO CHILL.'],'A separation event with main-character energy.',ORANGE)
    # Small schematic emblem: decorative, not a device design or scale drawing.
    bolt=Image.new('RGBA',(260,440));d=ImageDraw.Draw(bolt)
    d.polygon([(40,55),(90,20),(170,20),(220,55),(220,125),(170,160),(90,160),(40,125)],fill='#bccbd3',outline='#ffffff',width=5)
    d.rounded_rectangle((95,145,165,380),12,fill='#8aabb8',outline='#d6e3e9',width=4)
    for y in range(176,370,19):d.line((94,y+12,166,y),fill='#284b5c',width=5)
    bolt=bolt.rotate(-24,resample=Image.Resampling.BICUBIC,expand=True).resize((170,230))
    im.paste(bolt,(1640,300),bolt)
    return im

def blast_overlay(headline,sub=''):
    im=Image.new('RGBA',(W,H));d=ImageDraw.Draw(im)
    d.rectangle((0,0,W,95),fill='#03070c');d.rectangle((0,900,W,H),fill='#03070c')
    d.rectangle((0,95,W,310),fill=(3,7,12,180));d.rectangle((0,780,W,900),fill=(3,7,12,200))
    size=108
    while ImageDraw.Draw(im).textbbox((0,0),headline,font=font(size,True))[2]>1740:size-=2
    center(im,160,headline,size,WHITE,True)
    if sub:center(im,813,sub,37,ORANGE,True)
    return im

CARDS={
 'bolt':bolt_card(),
 'shock':blast_overlay('A SHOCK IS COMING.','Your electronics would like a word.'),
 'hero':title('INTRODUCING',['SHOCK','PREDICTION WORKBENCH'],'Source  /  Structure  /  Component'),
 'point':tool('SOURCE FILE  /  01','SEPARATION BOLTS.','source','Small device. Enthusiastic structural response.',crop=(0,0,1198,475),tag='POINT SOURCE'),
 'line':tool('SOURCE FILE  /  02','LINEAR SHAPED CHARGES.','linear-source','Different source. Same need for evidence.',crop=(0,0,1198,475),tag='LINE SOURCE'),
 'overview':tool('MISSION CONTROL','ASSESS THE AFTERMATH.','overview','Source evidence. Transmission assumptions. Component environments.'),
 'load':tool('THE MISSION  /  01','LOAD THE SOURCE.','source','SRS or time history. Units, damping, bandwidth and evidence.',crop=(0,425,1198,925)),
 'trace':tool('THE MISSION  /  02','TRACE THE PATH.','ratio','Use a justified transfer model. Keep the assumptions visible.'),
 'compare':tool('THE MISSION  /  03','COMPARE THE ENVIRONMENT.','baseline','Predicted demand versus component test coverage.',tag='COVERAGE GAP ≠ SURVIVAL CLAIM'),
 'direct':title('THE METHODS  /  01',['DIRECT','INTERFACE ENVIRONMENT'],'Start with the environment at the assessment interface.'),
 'ratio':tool('THE METHODS  /  02','WHOLE-PATH SRS RATIOS.','ratio','Measured or justified ratios. Amplification allowed.'),
 'distance':tool('THE METHODS  /  03','CALIBRATED DISTANCE MODELS.','distance','Structural path length. Explicit calibration limits.'),
 'factors':tool('THE METHODS  /  04','BANDED PATH FACTORS.','factors','Distinct effects. Signed dB gains. No double counting.'),
 'isolation':tool('THE METHODS  /  05','TIME-DOMAIN ISOLATION.','history','Propagate the waveform. Then recompute the SRS.'),
 'relocation':tool('PLOT TWIST','TRY A NEW LOCATION.','relocation','Compare the alternative path. Keep its evidence conditions.',tag='TEACHING TRADE'),
 'margins':tool('KNOW WHAT YOU ADDED','CHECK THE MARGINS.','evidence','Engineering allowance and test margin stay separate.'),
 'travel':tool('THE MOUNT HAS LIMITS','CHECK THE TRAVEL.','mount','Linear isolation assumes adequate clearance.'),
 'contact':tool('CONTACT DETECTED','THAT IS NOT ENOUGH TRAVEL.','contact','The tool flags when the linear model is no longer valid.',color=ORANGE,tag='LINEAR RESULT INVALID'),
 'fine':title('FAMOUS LAST WORDS',["“IT’LL PROBABLY",'BE FINE.”'],'— an uncalibrated engineering model',ORANGE),
 'function':title('TECHNICAL REVIEW',["IS NOT A",'TRANSFER FUNCTION.'],'Please attach evidence. The explosion is optional.',ORANGE),
 'reveal':blast_overlay('SHOCK PREDICTION WORKBENCH','BIG DRAMA. BETTER EVIDENCE.'),
 'available':title('NOW AVAILABLE TO THE TEAM',['BIG DRAMA.','BETTER EVIDENCE.'],'Offline  •  Source-to-component assessments  •  Shareable reports'),
 'credits':title('A VERY IMPORTANT PRODUCTION NOTE',['NO ACTUAL HARDWARE','WAS HARMED.'],'Real tool captures. Stock explosion footage. Synthetic narration.'),
 'dramatic':tool('THE DEMO DATA, HOWEVER…','EXTREMELY DRAMATIC.','compare','Illustrative inputs. Hardware-specific models still need validation.',tag='TEACHING DATA / MAXIMUM DRAMA'),
 'end':title('YOUR NEXT SHOCK REVIEW HAS A NEW TOOL',['SHOCK','PREDICTION WORKBENCH'],'OPEN  useful-tools / Shock-Prediction / shock_workbench.html'),
}

# Times follow the generated word timestamps, slowed to 90% with a one-second lead.
SHOTS=[(0,5.3,'bolt'),(5.3,9.2,'shock'),(9.2,12.35,'hero'),(12.35,13.9,'point'),(13.9,15.5,'line'),(15.5,18,'overview'),(18,19.3,'load'),(19.3,20.65,'trace'),(20.65,22.6,'compare'),(22.6,24.35,'direct'),(24.35,25.75,'ratio'),(25.75,27.2,'distance'),(27.2,28.8,'factors'),(28.8,30.75,'isolation'),(30.75,33.1,'relocation'),(33.1,34.75,'margins'),(34.75,37.4,'travel'),(37.4,39.2,'contact'),(39.2,42.05,'fine'),(42.05,43.9,'function'),(43.9,47.9,'reveal'),(47.9,50.7,'available'),(50.7,54.2,'credits'),(54.2,57.4,'dramatic'),(57.4,TOTAL,'end')]

def render_shot(i,shot):
    start,end,name=shot;frames=round(end*FPS)-round(start*FPS);duration=frames/FPS
    out=RENDER/f'{i:02}.mp4'
    if len(sys.argv)>1 and i not in set(map(int,sys.argv[1].split(','))) and out.exists():return out
    png=RENDER/(name+'.png');CARDS[name].save(png)
    if name in ['shock','reveal']:
        vf=f'[0:v]setpts=1.55*PTS,scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},eq=brightness=-0.10:saturation=0.85,fps={FPS}[b];[b][1:v]overlay=0:0,fade=t=in:st=0:d=0.08,fade=t=out:st={duration-.12}:d=0.12[v]'
        ff(['-i',ASSETS/'fireball.mp4','-loop','1','-i',png,'-filter_complex',vf,'-map','[v]','-an','-frames:v',frames,'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-threads','3',out])
    else:
        # Slow digital push preserves readable real UI captures; hard cuts carry the action rhythm.
        zoom=f"zoompan=z='1.012+0.012*on/{frames}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d={frames}:s={W}x{H}:fps={FPS}"
        vf=zoom+f',fade=t=in:st=0:d=0.10,fade=t=out:st={duration-.10}:d=0.10'
        ff(['-i',png,'-vf',vf,'-an','-frames:v',frames,'-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-threads','3',out])
    print('Rendered',name,flush=True)
    return out

def captions():
    narration=json.loads((ROOT/'narration.json').read_text())
    words=[w for w in narration['words'] if not w['word'].startswith('<')]
    chunks=[];chunk=[]
    for word in words:
        chunk.append(word)
        if len(chunk)>=8 or word['word'].endswith(('.', '?', '!')):
            chunks.append(chunk);chunk=[]
    if chunk:chunks.append(chunk)
    def stamp(t,ass=False):
        h=int(t//3600);m=int(t%3600//60);s=t%60
        return f'{h}:{m:02}:{s:05.2f}' if ass else f'{h:02}:{m:02}:{int(s):02},{round((s-int(s))*1000):03}'
    srt=[];events=[]
    for i,c in enumerate(chunks):
        start=LEAD+c[0]['start']/SPEED;end=min(LEAD+c[-1]['end']/SPEED+.10,TOTAL);line=' '.join(w['word'] for w in c)
        srt.append(f'{i+1}\n{stamp(start)} --> {stamp(end)}\n{line}\n')
        events.append(f'Dialogue: 0,{stamp(start,True)},{stamp(end,True)},Default,,0,0,0,,{line}')
    (ROOT/'shock_workbench_trailer.srt').write_text('\n'.join(srt),encoding='utf8')
    head='[Script Info]\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,34,&H00F6F6F6,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,1,0,2,90,90,27,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n'
    (RENDER/'captions.ass').write_text(head+'\n'.join(events),encoding='utf8')

def sound_design():
    sr=48000;rng=np.random.default_rng(17);audio=np.zeros((round(TOTAL*sr),2),np.float64)
    for time in [5.3,9.2,12.35,13.9,22.6,24.35,25.75,27.2,28.8,37.4,42.05,43.9,57.4]:
        duration=1.35 if time in [5.3,43.9] else .65;t=np.arange(round(duration*sr))/sr
        freq=75-35*np.minimum(t/duration,1);phase=2*np.pi*np.cumsum(freq)/sr
        low=np.sin(phase)*np.exp(-t*5)
        noise=rng.normal(0,1,len(t));noise=np.convolve(noise,np.ones(19)/19,mode='same')
        hit=(low*.45+noise*.5)*np.minimum(t/.008,1)*np.exp(-t*1.5)
        if time not in [5.3,43.9]:hit*=.45
        j=round(time*sr);audio[j:j+len(hit),:]+=hit[:,None]
    # Descending error chirp at contact; a short, dry comedic punctuation.
    t=np.arange(round(.32*sr))/sr;chirp=.10*np.sin(2*np.pi*(330*t-180*t*t))*np.sin(np.pi*t/.32)**2
    j=round(37.4*sr);audio[j:j+len(chirp)]+=chirp[:,None]
    with wave.open(str(RENDER/'impacts.wav'),'wb') as f:f.setparams((2,2,sr,0,'NONE','not compressed'));f.writeframes((np.clip(audio,-.95,.95)*32767).astype('<i2').tobytes())

if __name__=='__main__':
    captions();sound_design()
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:outputs=list(pool.map(lambda arg:render_shot(*arg),enumerate(SHOTS)))
    (RENDER/'concat.txt').write_text('\n'.join("file '"+p.name+"'" for p in outputs))
    ff(['-f','concat','-safe','0','-i',RENDER/'concat.txt','-c','copy',RENDER/'picture.mp4'])
    # Duck the score under narration, leave headroom for effects, then normalize the stereo mix.
    mix=f'[0:a]atempo={SPEED},highpass=f=70,volume=1.3,adelay=1000|1000,apad=whole_dur={TOTAL},asplit=2[voice][key];[1:a]atrim=0:{TOTAL},volume=0.22,afade=t=in:d=2,afade=t=out:st=58:d=3.5[score];[score][key]sidechaincompress=threshold=0.015:ratio=5:attack=15:release=350[duck];[voice][duck][2:a]amix=inputs=3:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=9,atrim=0:{TOTAL}[mix]'
    ff(['-i',ASSETS/'narration.wav','-i',ASSETS/'music.wav','-i',RENDER/'impacts.wav','-filter_complex',mix,'-map','[mix]','-ar','48000','-ac','2',RENDER/'mix.wav'])
    ff(['-i',RENDER/'picture.mp4','-i',RENDER/'mix.wav','-vf','ass=render/captions.ass','-map','0:v','-map','1:a','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t',TOTAL,'-movflags','+faststart','-threads','6',ROOT/'shock_workbench_trailer.mp4'])
    # A small team-chat copy, plus poster and sampled review contact sheet.
    ff(['-i',ROOT/'shock_workbench_trailer.mp4','-vf','scale=1280:720','-c:v','libx264','-crf','23','-preset','fast','-c:a','aac','-b:a','128k','-movflags','+faststart',ROOT/'shock_workbench_trailer_720p.mp4'])
    CARDS['hero'].save(ROOT/'poster.jpg',quality=93)
    ff(['-i',ROOT/'shock_workbench_trailer.mp4','-vf','fps=1/3,scale=480:270,tile=4x6','-frames:v','1',RENDER/'contact-sheet.jpg'])
    print('Finished',ROOT/'shock_workbench_trailer.mp4',flush=True)
