from pathlib import Path
from collections import deque

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = Path(r"C:\Users\Tommy\.codex\generated_images\019ede36-a6c7-7f22-a87f-f24865328cfa")
OUTPUT_DIR = ROOT / "assets" / "images" / "monster-actions"
TMP_DIR = ROOT / "tmp" / "imagegen" / "monster-actions"

SHEETS = {
    "attack": SOURCE_DIR / "ig_0eae5845c754dc6f016a34cb44e0208198bd5c7f45a45d0e1c.png",
    "hurt": SOURCE_DIR / "ig_0eae5845c754dc6f016a34cbba09d48198963266c1b1323dc6.png",
    "death": SOURCE_DIR / "ig_0eae5845c754dc6f016a34cc262be08198be726295650dc61b.png",
}

MONSTERS = [
    "black-candle-cultist",
    "flesh-guard",
    "goblin",
    "shadow-beast",
    "skeleton",
    "slime",
    "tomb-hunter",
    "wolf",
]

CANVAS_SIZE = (640, 560)
KEY = (0, 255, 0)


def key_distance(pixel):
    return abs(pixel[0] - KEY[0]) + abs(pixel[1] - KEY[1]) + abs(pixel[2] - KEY[2])


def is_key_candidate(r, g, b):
    green_advantage = g - max(r, b)
    return (
        key_distance((r, g, b)) < 92
        or (g > 145 and green_advantage > 42)
        or (g > 115 and green_advantage > 68)
    )


def connected_key_mask(image):
    width, height = image.size
    pixels = image.load()
    mask = [[False] * width for _ in range(height)]
    queue = deque()

    def add_if_background(x, y):
        if mask[y][x]:
            return
        r, g, b, _ = pixels[x, y]
        if is_key_candidate(r, g, b):
            mask[y][x] = True
            queue.append((x, y))

    for x in range(width):
        add_if_background(x, 0)
        add_if_background(x, height - 1)
    for y in range(height):
        add_if_background(0, y)
        add_if_background(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < width and 0 <= ny < height:
                add_if_background(nx, ny)

    return mask


def is_near_background(mask, x, y, radius=2):
    height = len(mask)
    width = len(mask[0])
    for ny in range(max(0, y - radius), min(height, y + radius + 1)):
        for nx in range(max(0, x - radius), min(width, x + radius + 1)):
            if mask[ny][nx]:
                return True
    return False


def remove_green_background(image):
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    background_mask = connected_key_mask(image)

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            green_advantage = g - max(r, b)

            if background_mask[y][x]:
                pixels[x, y] = (7, 6, 5, 0)
                continue

            near_background = is_near_background(background_mask, x, y, 2)
            if near_background and green_advantage > 18:
                new_alpha = int(a * max(0.0, min(1.0, 1.0 - ((green_advantage - 18) / 115))))
                g = min(g, max(r, b) + 4)
                pixels[x, y] = (r, g, b, new_alpha)
            elif green_advantage > 10:
                g = min(g, max(r, b) + 8)
                pixels[x, y] = (r, g, b, a)

    return image


def trim_alpha(image):
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return image

    padding = 18
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(image.width, bbox[2] + padding)
    bottom = min(image.height, bbox[3] + padding)
    return image.crop((left, top, right, bottom))


def fit_on_canvas(image):
    image = trim_alpha(image)
    canvas_width, canvas_height = CANVAS_SIZE
    scale = min(canvas_width / image.width, canvas_height / image.height, 1.0)
    new_size = (max(1, int(image.width * scale)), max(1, int(image.height * scale)))
    image = image.resize(new_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", CANVAS_SIZE, (0, 0, 0, 0))
    x = (canvas_width - image.width) // 2
    y = canvas_height - image.height
    canvas.alpha_composite(image, (x, y))
    return canvas


def has_transparent_corners(image):
    alpha = image.getchannel("A")
    return all(alpha.getpixel(point) == 0 for point in [
        (0, 0),
        (image.width - 1, 0),
        (0, image.height - 1),
        (image.width - 1, image.height - 1),
    ])


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)

    created = []

    for action, sheet_path in SHEETS.items():
        sheet = Image.open(sheet_path).convert("RGB")
        cell_width = sheet.width // 4
        cell_height = sheet.height // 2

        for index, monster in enumerate(MONSTERS):
            col = index % 4
            row = index // 4
            cell = sheet.crop((
                col * cell_width,
                row * cell_height,
                (col + 1) * cell_width,
                (row + 1) * cell_height,
            ))
            transparent = remove_green_background(cell)
            final = fit_on_canvas(transparent)

            if not has_transparent_corners(final):
                raise RuntimeError(f"transparent corner validation failed for {monster} {action}")

            base_name = f"monster-{monster}-{action}"
            png_path = TMP_DIR / f"{base_name}.png"
            webp_path = OUTPUT_DIR / f"{base_name}.webp"
            final.save(png_path)
            final.save(webp_path, "WEBP", method=6, lossless=True, exact=True)
            created.append(webp_path)

    print(f"created {len(created)} monster action assets")
    for path in created:
        print(path.relative_to(ROOT).as_posix())


if __name__ == "__main__":
    main()
