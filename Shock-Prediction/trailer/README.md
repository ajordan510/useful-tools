# Shock Workbench — action-comedy announcement trailer

**61.5 seconds · 16:9 · narrated · music and effects · burned-in captions**

- [1080p trailer](shock_workbench_trailer.mp4) — presentation / screen-share copy.
- [720p trailer](shock_workbench_trailer_720p.mp4) — smaller team-chat attachment.
- [Caption file](shock_workbench_trailer.srt) — optional separate transcript/timing file; captions are already visible in both videos.
- [Poster](poster.jpg).

The trailer introduces source families, five implemented prediction approaches, a relocation comparison, explicit margins, and an isolator clearance warning. The comedic premise is “one tiny bolt, absolutely no chill,” with the reminder that “it'll probably be fine” is not a transfer function.

All interface images are captures of the actual workbench. The examples are marked illustrative. The fireball is stock visual-effects footage used for the trailer, not evidence of separation-device behavior or tool validation. No source-device or hardware-survival claims are made.

## Production and asset credits

| Element | Source / treatment |
|---|---|
| Tool interface | This repository's `Shock-Prediction/shock_workbench.html`; captured by `capture.cjs` |
| Explosion footage | [Fire Explosion, Pixabay on Pexels, video 856227](https://www.pexels.com/video/fire-explosion-856227/), marked Free / CC0 by the source page. Download link resolves to the 1920 × 960, 24 fps file. Edited, slowed, graded and composited into the trailer. [Pexels license](https://www.pexels.com/license/) |
| Narration | HeyGen Voice / Orca, public voice **Ray**. Synthetic narration from the original trailer script. Created after approval to retry using the workspace-required engine. Request `6fcd9c5c95ca4d689063c4f44c02f956`; source duration 50.4947 s, edited at 90% speed with a 1 s lead |
| Music | HeyGen connected audio catalog: **Astral Generated Music: 1768bf0b**, asset `1768bf0b7d15450bb2133e0366f7cfe1`, described as an epic cinematic trailer / orchestral build / heavy percussion / crescendo. Edited and ducked beneath narration |
| Impacts / error chirp | Original procedural synthesis in `render.py` |
| Titles / schematic bolt | Original motion-graphic compositions in `render.py`; the bolt is a decorative emblem, not a design drawing |

Standalone source music, narration, footage and intermediate render files are excluded from Git. The finished videos contain the edited soundtrack and footage. Catalog assets should not be redistributed as a standalone stock library. No messages were sent to team members and no public video hosting was created.

## Edit or reproduce

`capture.cjs` uses Playwright and desktop Chrome to capture real tool states. Set `CHROMIUM_PATH` for a different browser executable and `NODE_PATH` if needed. `render.py` requires Python, Pillow, NumPy and imageio-ffmpeg, and uses the Windows Bahnschrift/Arial fonts (update the font paths on other platforms).

```powershell
node Shock-Prediction/trailer/capture.cjs
python Shock-Prediction/trailer/fetch_assets.py
python Shock-Prediction/trailer/render.py
```

Before rendering, place the authorized narration and music downloads in `assets/narration.wav` and `assets/music.wav`. `fetch_assets.py` retrieves the publicly available fireball. The script, narration word timings and voice provenance are in `narration.json`. The `SHOTS` list in `render.py` controls the edit. Passing comma-separated shot indices rerenders only those shots before rebuilding the complete edit, e.g. `python render.py 0,1,20` from this folder.

Final files use H.264 video, AAC stereo audio, yuv420p pixel format and MP4 fast-start metadata. The soundtrack is mixed with narration-driven music ducking and loudness normalization targeted to −16 LUFS / −1.5 dBTP. See `verification.json` for actual measured results and decoding checks.

Suggested announcement copy:

> One tiny bolt. Absolutely no chill. Introducing Shock Prediction Workbench: source-to-component shock assessments, explicit transmission assumptions, isolation trades, and shareable reports. Watch the trailer, then open `Shock-Prediction/shock_workbench.html`. Teaching examples included; bring your hardware-specific evidence.
