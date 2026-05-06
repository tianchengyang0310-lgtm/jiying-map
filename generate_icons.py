"""
Generate Android app icons from a source image.
Usage: python generate_icons.py <source_image.jpg>
Output: mipmap PNGs in android/app/src/main/res/
"""
import sys, os
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow not installed. Run: pip install Pillow --break-system-packages")
    sys.exit(1)

# ── Config ──────────────────────────────────────────────────
SOURCE = sys.argv[1] if len(sys.argv) > 1 else r"D:\4.16\747738344427283440.jpg"
RES_DIR = Path(__file__).parent / "android" / "app" / "src" / "main" / "res"

# Adaptive icon foreground sizes (108dp at each density)
FOREGROUND_SIZES = {
    "mipmap-mdpi":    162,   # 108 * 1.5
    "mipmap-hdpi":    216,   # 108 * 2
    "mipmap-xhdpi":   324,   # 108 * 3
    "mipmap-xxhdpi":  432,   # 108 * 4
    "mipmap-xxxhdpi": 648,   # 108 * 6
}

# Regular launcher icon sizes (48dp at each density)
LAUNCHER_SIZES = {
    "mipmap-mdpi":    48,    # 48 * 1
    "mipmap-hdpi":    72,    # 48 * 1.5
    "mipmap-xhdpi":   96,    # 48 * 2
    "mipmap-xxhdpi":  144,   # 48 * 3
    "mipmap-xxxhdpi": 192,   # 48 * 4
}

# Adaptive icon safe zone: inner 66dp of 108dp = 61.1%
# Content should fit within the inner 72dp safe zone
SAFE_ZONE_RATIO = 72.0 / 108.0  # ~66.7%

PADDING_COLOR = (255, 248, 243, 0)  # transparent padding (RGBA)

# ── Main ────────────────────────────────────────────────────
print(f"Loading source image: {SOURCE}")
img = Image.open(SOURCE).convert("RGBA")
w, h = img.size
print(f"Original size: {w}x{h}")

# Step 1: Pad to square
if w != h:
    size = max(w, h)
    square = Image.new("RGBA", (size, size), PADDING_COLOR)
    offset_x = (size - w) // 2
    offset_y = (size - h) // 2
    square.paste(img, (offset_x, offset_y))
    img = square
    print(f"Padded to square: {size}x{size}")
else:
    print("Already square")

# Step 2: Generate regular launcher icons (full image, no safe zone)
print("\n--- Generating regular launcher icons ---")
for folder, size in sorted(LAUNCHER_SIZES.items(), key=lambda x: x[1]):
    out_dir = RES_DIR / folder
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "ic_launcher.png"
    resized = img.resize((size, size), Image.LANCZOS)
    resized.save(out_path, "PNG")
    print(f"  {folder}/ic_launcher.png  ({size}x{size})")

    # Also save as ic_launcher_round.png (same image for now)
    round_path = out_dir / "ic_launcher_round.png"
    resized.save(round_path, "PNG")

# Step 3: Generate adaptive icon foregrounds (with safe zone)
print("\n--- Generating adaptive icon foregrounds ---")
for folder, canvas_size in sorted(FOREGROUND_SIZES.items(), key=lambda x: x[1]):
    out_dir = RES_DIR / folder
    out_dir.mkdir(parents=True, exist_ok=True)

    # Create transparent canvas at full foreground size
    fg = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))

    # Place the image in the safe zone (inner 72dp)
    safe_size = int(canvas_size * SAFE_ZONE_RATIO)
    img_in_safe = img.resize((safe_size, safe_size), Image.LANCZOS)
    offset = (canvas_size - safe_size) // 2
    fg.paste(img_in_safe, (offset, offset))

    out_path = out_dir / "ic_launcher_foreground.png"
    fg.save(out_path, "PNG")
    print(f"  {folder}/ic_launcher_foreground.png  ({canvas_size}x{canvas_size}, safe={safe_size}x{safe_size})")

print("\nDone! All icons generated.")
print(f"Files written to: {RES_DIR}")
print("\nNext: update ic_launcher_background.xml if desired, then build with:")
print("  npx cap sync && cd android && .\\gradlew.bat assembleDebug")
