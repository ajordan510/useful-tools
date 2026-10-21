"""Download editorial source assets. Do not redistribute standalone catalog assets."""
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/'assets'
ASSETS.mkdir(exist_ok=True)

def fetch(url,name):
    out=ASSETS/name
    if out.exists():
        return out
    response=requests.get(url,timeout=120)
    response.raise_for_status()
    out.write_bytes(response.content)
    print(name,len(response.content))
    return out

if __name__=='__main__':
    # Resolved from the Pexels source page's public download link.
    fetch('https://videos.pexels.com/video-files/856227/856227-hd_1920_960_24fps.mp4','fireball.mp4')
