"""Generate square PWA icons using the committed official Baturaden 25 logo.
Only development-time output. Does not access backend or user data.
Requires Pillow: python -m pip install Pillow
"""
from pathlib import Path
from PIL import Image, ImageDraw
import base64, sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public/assets/Logo_Resmi_BTRD25_Transparan.png"
OUT = ROOT / "public/pwa"
OUT.mkdir(parents=True, exist_ok=True)

logo = Image.open(SOURCE).convert("RGBA")
bounds = logo.getbbox()
if not bounds:
    raise SystemExit("Official logo is empty")
logo = logo.crop(bounds)

def generate(size: int, maskable: bool):
    canvas = Image.new("RGBA", (size, size), (8, 9, 10, 255))
    if not maskable:
        draw = ImageDraw.Draw(canvas)
        inset = round(size * 0.06)
        draw.rounded_rectangle((inset, inset, size-inset-1, size-inset-1),
                               radius=round(size * 0.16), outline=(110, 82, 40, 255),
                               width=max(1, size // 256))
    max_w = round(size * (0.64 if maskable else 0.78))
    max_h = round(size * (0.40 if maskable else 0.56))
    scale = min(max_w/logo.width, max_h/logo.height)
    display = logo.resize((max(1, round(logo.width * scale)), max(1, round(logo.height * scale))),
                          Image.Resampling.LANCZOS)
    canvas.alpha_composite(display, ((size-display.width)//2, (size-display.height)//2))
    return canvas.convert("RGB").quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)

for name, size, maskable in [
    ("icon-192.png", 192, False),
    ("icon-512.png", 512, False),
    ("icon-maskable-512.png", 512, True),
]:
    path = OUT / name
    generate(size, maskable).save(path, "PNG", optimize=True, compress_level=9)
    raw = path.read_bytes()
    print(f"PWA_ICON_SIZE:{name}:{len(raw)}", flush=True)
    if "--emit-base64" in sys.argv:
        print("PWA_ICON_BASE64:" + name + ":" + base64.b64encode(raw).decode("ascii"), flush=True)
