"""Verify the final delivery files decode and measure duration, size and loudness."""
from pathlib import Path
import hashlib, json, re, subprocess
import imageio_ffmpeg

ROOT=Path(__file__).resolve().parent
FF=imageio_ffmpeg.get_ffmpeg_exe()
results=[]
for name,expected in [('shock_workbench_trailer.mp4',(1920,1080)),('shock_workbench_trailer_720p.mp4',(1280,720))]:
    p=ROOT/name
    reader=imageio_ffmpeg.read_frames(str(p));meta=next(reader);reader.close()
    assert tuple(meta['size'])==expected,meta
    assert abs(meta['duration']-61.5)<.1,meta
    assert abs(meta['fps']-24)<.01,meta
    check=subprocess.run([FF,'-v','error','-i',str(p),'-f','null','-'],capture_output=True)
    assert check.returncode==0 and not check.stderr,check.stderr
    meter=subprocess.run([FF,'-hide_banner','-i',str(p),'-vn','-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-'],capture_output=True)
    log=meter.stderr.decode(errors='replace')
    match=re.findall(r'\{\s*"input_i".*?\}',log,re.S)
    assert match,log
    levels=json.loads(match[-1])
    assert -18<float(levels['input_i'])<-13,levels
    assert float(levels['input_tp'])<-.5,levels
    results.append({'file':name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'width':meta['size'][0],'height':meta['size'][1],'fps':meta['fps'],'duration_seconds':meta['duration'],'full_decode':'passed','integrated_loudness_LUFS':float(levels['input_i']),'true_peak_dBTP':float(levels['input_tp'])})
    print(name,json.dumps(results[-1]),flush=True)
text=(ROOT/'shock_workbench_trailer.srt').read_text(encoding='utf8')
assert 'transfer function.' in text and 'dramatic.' in text
assert '00:00:' in text
result={'files':results,'captions':'burned into picture and provided as SRT','visual_review':'Sampled full-edit contact sheet plus title, method and explosion frames inspected.','sources':'See README.md; actual tool captures use illustrative inputs.'}
(ROOT/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
