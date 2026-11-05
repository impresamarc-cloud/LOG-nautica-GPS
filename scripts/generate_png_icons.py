import struct
import zlib
import os
import math

# 19 Polygons defining the Raymarine digital "00.0"
POLYGONS = [
    # First '0'
    [(79.02,110.00), (171.27,110.00), (174.39,113.29), (149.91,133.50), (98.08,133.50), (75.56,113.29)],
    [(173.72,112.58), (176.85,115.88), (170.70,241.66), (158.38,253.41), (147.20,241.66), (152.36,136.09)],
    [(158.12,258.59), (169.30,270.34), (163.15,396.13), (159.70,399.42), (140.64,375.92), (145.80,270.34)],
    [(86.09,378.50), (137.92,378.50), (160.44,398.71), (156.98,402.00), (64.73,402.00), (61.61,398.71)],
    [(65.30,270.34), (77.62,258.59), (88.80,270.34), (83.64,375.92), (62.28,399.42), (59.15,396.13)],
    [(72.85,115.88), (76.30,112.58), (95.36,136.09), (90.20,241.66), (77.88,253.41), (66.70,241.66)],

    # Second '0'
    [(201.02,110.00), (293.27,110.00), (296.39,113.29), (271.91,133.50), (220.08,133.50), (197.56,113.29)],
    [(295.72,112.58), (298.85,115.88), (292.70,241.66), (280.38,253.41), (269.20,241.66), (274.36,136.09)],
    [(280.12,258.59), (291.30,270.34), (285.15,396.13), (281.70,399.42), (262.64,375.92), (267.80,270.34)],
    [(208.09,378.50), (259.92,378.50), (282.44,398.71), (278.98,402.00), (186.73,402.00), (183.61,398.71)],
    [(187.30,270.34), (199.62,258.59), (210.80,270.34), (205.64,375.92), (184.28,399.42), (181.15,396.13)],
    [(194.85,115.88), (198.30,112.58), (217.36,136.09), (212.20,241.66), (199.88,253.41), (188.70,241.66)],

    # Nautical Point '.'
    [(302.01,378.50), (323.01,378.50), (321.86,402.00), (300.86,402.00)],

    # Third '0'
    [(359.02,110.00), (451.27,110.00), (454.39,113.29), (429.91,133.50), (378.08,133.50), (355.56,113.29)],
    [(453.72,112.58), (456.85,115.88), (450.70,241.66), (438.38,253.41), (427.20,241.66), (432.36,136.09)],
    [(438.12,258.59), (449.30,270.34), (443.15,396.13), (439.70,399.42), (420.64,375.92), (425.80,270.34)],
    [(366.09,378.50), (417.92,378.50), (440.44,398.71), (436.98,402.00), (344.73,402.00), (341.61,398.71)],
    [(345.30,270.34), (357.62,258.59), (368.80,270.34), (363.64,375.92), (342.28,399.42), (339.15,396.13)],
    [(352.85,115.88), (356.30,112.58), (375.36,136.09), (370.20,241.66), (357.88,253.41), (346.70,241.66)],
]

# Scale around center 256, 256 with factor 0.76 for optimal icon border clearance
SCALE = 0.76
SCALED_POLYS = []
for poly in POLYGONS:
    sp = []
    for (x, y) in poly:
        nx = 256.0 + (x - 256.0) * SCALE
        ny = 256.0 + (y - 256.0) * SCALE
        sp.append((nx, ny))
    SCALED_POLYS.append(sp)

POLY_BBOXES = []
for p in SCALED_POLYS:
    min_x = min(pt[0] for pt in p)
    max_x = max(pt[0] for pt in p)
    min_y = min(pt[1] for pt in p)
    max_y = max(pt[1] for pt in p)
    POLY_BBOXES.append((min_x, max_x, min_y, max_y))

def point_in_polygon(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        p1 = poly[i]
        p2 = poly[(i + 1) % n]
        if ((p1[1] > y) != (p2[1] > y)) and (x < (p2[0] - p1[0]) * (y - p1[1]) / (p2[1] - p1[1]) + p1[0]):
            inside = not inside
    return inside

def is_foreground(sx, sy):
    for i, (min_x, max_x, min_y, max_y) in enumerate(POLY_BBOXES):
        if min_x <= sx <= max_x and min_y <= sy <= max_y:
            if point_in_polygon(sx, sy, SCALED_POLYS[i]):
                return True
    return False

def write_png(filename, width, height, rgba_data):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type None
        raw.extend(rgba_data[y * width * 4 : (y + 1) * width * 4])

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)

    os.makedirs(os.path.dirname(os.path.abspath(filename)), exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', ihdr))
        f.write(chunk(b'IDAT', idat))
        f.write(chunk(b'IEND', b''))

def render_icon(size, is_round=False):
    rgba = bytearray(size * size * 4)
    cx, cy = size / 2.0, size / 2.0
    radius = size / 2.0
    scale_factor = 512.0 / size

    for y in range(size):
        for x in range(size):
            idx = (y * size + x) * 4

            if is_round:
                dist = math.hypot(x + 0.5 - cx, y + 0.5 - cy)
                if dist > radius:
                    rgba[idx:idx+4] = b'\x00\x00\x00\x00'
                    continue

            # 2x2 Supersampling for smooth Raymarine digit edges
            fg_count = 0
            for dy in (0.25, 0.75):
                for dx in (0.25, 0.75):
                    sx = (x + dx) * scale_factor
                    sy = (y + dy) * scale_factor
                    if is_foreground(sx, sy):
                        fg_count += 1

            if fg_count == 4:
                # Solid white 00.0 Raymarine digit
                rgba[idx:idx+4] = b'\xff\xff\xff\xff'
            elif fg_count > 0:
                # Anti-aliased white digit edge over pure black
                val = int(255 * (fg_count / 4.0))
                rgba[idx:idx+4] = bytes([val, val, val, 255])
            else:
                # Raymarine deep cockpit black
                rgba[idx:idx+4] = b'\x00\x00\x00\xff'

    return bytes(rgba)

def main():
    print("Generating Raymarine 00.0 icons...")
    targets = [
        ("app/src/main/res/mipmap-mdpi/ic_launcher.png", 48, False),
        ("app/src/main/res/mipmap-mdpi/ic_launcher_round.png", 48, True),
        ("app/src/main/res/mipmap-hdpi/ic_launcher.png", 72, False),
        ("app/src/main/res/mipmap-hdpi/ic_launcher_round.png", 72, True),
        ("app/src/main/res/mipmap-xhdpi/ic_launcher.png", 96, False),
        ("app/src/main/res/mipmap-xhdpi/ic_launcher_round.png", 96, True),
        ("app/src/main/res/mipmap-xxhdpi/ic_launcher.png", 144, False),
        ("app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png", 144, True),
        ("app/src/main/res/mipmap-xxxhdpi/ic_launcher.png", 192, False),
        ("app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png", 192, True),
        ("public/pwa-192x192.png", 192, False),
        ("public/apple-touch-icon.png", 180, False),
        ("public/pwa-512x512.png", 512, False),
        ("public/pwa-maskable-512x512.png", 512, False),
        ("app/src/main/assets/pwa-192x192.png", 192, False),
        ("app/src/main/assets/apple-touch-icon.png", 180, False),
        ("app/src/main/assets/pwa-512x512.png", 512, False),
        ("app/src/main/assets/pwa-maskable-512x512.png", 512, False),
    ]

    cache = {}
    for path, size, is_round in targets:
        key = (size, is_round)
        if key not in cache:
            print(f"Rendering {size}x{size} (round={is_round})...")
            cache[key] = render_icon(size, is_round)
        write_png(path, size, size, cache[key])
        print(f"Saved {path}")

    print("All icons successfully generated!")

if __name__ == "__main__":
    main()
