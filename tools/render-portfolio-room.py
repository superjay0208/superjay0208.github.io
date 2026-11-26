"""Render the portfolio's two original room plates. Requires NumPy and Pillow."""
from pathlib import Path

import numpy as np
from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / "assets" / "portfolio"

# Coordinates match the fixed view and lens origin in portfolio.js.
# Positive Z faces the camera. The title wall is at Z = 0.
VIEWS = {
    "room": (1440, 690, 720, 313, 950),
    "room-phone": (640, 850, 400, 455, 650),
}
EYE = np.array([0, 0.8, 8.5], dtype=np.float32)
ROOM = []


def box(center, size, color, material="plain"):
    center, size = np.asarray(center), np.asarray(size)
    ROOM.append((center - size / 2, center + size / 2, color, material))


# Cast concrete panels and ceiling coffers follow the project's Room 04.
box((0, 1.2, -.16), (22, 12, .32), (105, 105, 93), "wall")
box((0, -1.6, 3), (22, .28, 13), (60, 60, 54), "floor")
box((-6.4, .8, 4), (.25, 9, 8), (77, 79, 72), "wall")
box((0, 4.68, 3.5), (17, .32, 8), (67, 65, 58))
for z in (.54, 1.96, 3.38, 4.8):
    box((0, 4.35, z), (15, .56, .26), (85, 86, 76))
box((-4.65, 1.3, .42), (.56, 6, .84), (87, 89, 79), "wall")

# Door and the small red practical at the back of the room.
box((4.19, -.39, .018), (1.35, 2.13, .045), (30, 29, 25))
for edge in (3.50, 4.89):
    box((edge, -.39, .09), (.07, 2.18, .15), (73, 66, 53))
box((4.2, .72, .08), (1.44, .085, .16), (65, 58, 48))
box((4.2, .89, .1), (.43, .084, .14), (116, 44, 35))
box((4.2, .89, .184), (.29, .028, .02), (226, 62, 40), "emissive")
box((4.67, -.48, .072), (.035, .19, .07), (131, 122, 92))

# Steel bench and original AV chassis. The small carriage runs above the lens.
box((-2.56, -.47, 3.82), (2.55, .15, 1.53), (75, 69, 55))
for x in (-3.66, -1.46):
    for z in (3.18, 4.46):
        box((x, -.95, z), (.105, .96, .105), (35, 40, 37))
box((-2.56, -1.15, 3.82), (2.39, .065, 1.36), (43, 43, 37))
box((-2.82, -.15, 3.85), (1.38, .48, .86), (100, 101, 79), "metal")
box((-2.82, .103, 3.85), (1.44, .075, .91), (114, 111, 89), "metal")
box((-2.82, -.405, 3.85), (1.32, .055, .8), (32, 35, 32))
box((-2.1, -.03, 3.7), (.32, .29, .41), (42, 46, 41), "metal")
box((-2.84, .181, 3.85), (.71, .055, .075), (47, 48, 42))
for x in (-3.16, -2.52):
    box((x, .144, 3.85), (.055, .11, .075), (49, 50, 44))
for n in range(10):
    box((-3.34 + n * .069, -.10, 4.289), (.027, .186, .014), (25, 29, 25))
box((-2.41, -.187, 4.287), (.32, .11, .022), (155, 144, 110))
box((-2.237, -.06, 4.30), (.04, .03, .018), (231, 73, 39), "emissive")
box((-.98, -1.35, 1.22), (.73, .42, .58), (95, 79, 56))
box((-.98, -1.13, 1.22), (.74, .045, .60), (105, 87, 62))
box((-4.5, -1.12, 1.38), (.66, .67, .91), (57, 55, 44))


def render(view):
    width, height, cx, cy, focal = view
    py, px = np.indices((height, width), dtype=np.float32)
    rays = np.stack(((px - cx) / focal, (cy - py) / focal, np.full_like(px, -1)), axis=-1)
    inverse = 1 / np.where(abs(rays) > 1e-6, rays, 1e-6)
    depth = np.full((height, width), 100, dtype=np.float32)
    surface = np.full((height, width), -1, dtype=np.int32)
    axis_hits = np.zeros((height, width), dtype=np.int8)

    for index, (low, high, _, _) in enumerate(ROOM):
        a, b = (low - EYE) * inverse, (high - EYE) * inverse
        near_axes = np.minimum(a, b)
        near = near_axes.max(axis=-1)
        far = np.maximum(a, b).min(axis=-1)
        hit = (near > .01) & (near <= far) & (near < depth)
        depth[hit] = near[hit]
        surface[hit] = index
        axis_hits[hit] = near_axes[hit].argmax(axis=-1)

    rng = np.random.default_rng(184)
    result = np.zeros((height, width, 3), dtype=np.float32)
    for index, (_, _, color, material) in enumerate(ROOM):
        mask = surface == index
        if not mask.any():
            continue
        ray = rays[mask]
        points = EYE + ray * depth[mask, None]
        axes = axis_hits[mask]
        normal = np.eye(3, dtype=np.float32)[axes] * -np.sign(ray[np.arange(len(axes)), axes])[:, None]
        x, y, z = points.T
        light = np.full((len(points), 3), .22, dtype=np.float32)
        for position, tint, strength, spread in [
            ((-2.15, 3.45, 2.3), (.84, .91, 1), 1.7, 5.8),
            ((-.35, 2.7, 5.7), (1, .83, .60), .58, 5.2),
            ((4.2, .89, .3), (1, .105, .03), 1.25, .58),
        ]:
            vector = np.asarray(position, dtype=np.float32) - points
            distance = np.maximum(np.linalg.norm(vector, axis=1), .18)
            directional = np.maximum(np.sum(vector * normal, axis=1) / distance, 0)
            amount = strength * directional / (1 + (distance / spread) ** 2)
            light += amount[:, None] * np.asarray(tint)
        texture = rng.normal(0, .031, len(points))
        texture += .041 * np.sin(x * 5.7 + np.sin(y * 6.2)) * np.sin(y * 4.8 + z * 4)
        if material in ("wall", "floor"):
            u, v = (np.where(axes == 0, z, x), y if material == "wall" else z)
            course = np.floor((v + .24) / .82)
            seam_x = abs(((u + course % 2 * .66) / 1.32 + .5) % 1 - .5)
            seam_y = abs(((v + .24) / .82 + .5) % 1 - .5)
            texture += np.where((seam_x < .0045) | (seam_y < .0055), -.26, 0)
            texture += np.where((seam_x - .11) ** 2 + (seam_y - .085) ** 2 < .00022, -.31, 0)
        if material == "metal":
            texture += .055 * np.sin(x * 210 + z * 27)
        base = np.asarray(color, dtype=np.float32) / 255
        result[mask] = base * (light if material != "emissive" else 1.22) * (1 + texture[:, None])

    falloff = np.clip(1 - .20 * ((px / width - .49) ** 2 + (py / height - .32) ** 2), .7, 1)
    result *= falloff[..., None]
    rgb = np.clip(result * 255 + rng.normal(0, .6, (height, width, 1)), 0, 255)
    return Image.fromarray(rgb.astype(np.uint8))


if __name__ == "__main__":
    ASSETS.mkdir(parents=True, exist_ok=True)
    for name, view in VIEWS.items():
        render(view).save(ASSETS / f"{name}.webp", "WEBP", quality=83, method=6)
