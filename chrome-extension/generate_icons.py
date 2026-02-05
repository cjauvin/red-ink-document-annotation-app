#!/usr/bin/env python3
"""Generate PNG icons for the Chrome extension."""

import struct
import zlib


def create_png(width: int, height: int, color: tuple[int, int, int]) -> bytes:
    """Create a simple solid color PNG."""

    def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
        chunk_len = struct.pack(">I", len(data))
        chunk_crc = struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        return chunk_len + chunk_type + data + chunk_crc

    # PNG signature
    signature = b"\x89PNG\r\n\x1a\n"

    # IHDR chunk
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    ihdr = png_chunk(b"IHDR", ihdr_data)

    # IDAT chunk (image data)
    raw_data = b""
    for _ in range(height):
        raw_data += b"\x00"  # Filter byte
        for _ in range(width):
            raw_data += bytes(color)

    compressed = zlib.compress(raw_data, 9)
    idat = png_chunk(b"IDAT", compressed)

    # IEND chunk
    iend = png_chunk(b"IEND", b"")

    return signature + ihdr + idat + iend


def create_icon_with_arrow(size: int) -> bytes:
    """Create a red icon with an up arrow."""
    # Create image data with RGBA
    pixels = []

    center_x = size // 2
    center_y = size // 2

    # Red background color
    bg_color = (239, 68, 68)  # #EF4444
    arrow_color = (255, 255, 255)  # White

    for y in range(size):
        row = []
        for x in range(size):
            # Check if pixel is part of the arrow
            # Arrow head (triangle pointing up)
            arrow_height = size * 0.6
            arrow_width = size * 0.5
            shaft_width = size * 0.15
            head_height = size * 0.3

            # Relative positions
            rel_x = x - center_x
            rel_y = y - center_y

            # Arrow shaft
            shaft_top = -arrow_height / 2 + head_height
            shaft_bottom = arrow_height / 2
            is_shaft = (
                abs(rel_x) <= shaft_width / 2
                and shaft_top <= rel_y <= shaft_bottom
            )

            # Arrow head (triangle)
            head_top = -arrow_height / 2
            head_bottom = shaft_top
            if head_top <= rel_y <= head_bottom:
                # Width increases as we go down
                progress = (rel_y - head_top) / (head_bottom - head_top)
                max_x = arrow_width / 2 * progress
                is_head = abs(rel_x) <= max_x
            else:
                is_head = False

            if is_shaft or is_head:
                row.append(arrow_color)
            else:
                row.append(bg_color)
        pixels.append(row)

    # Convert to PNG
    def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
        chunk_len = struct.pack(">I", len(data))
        chunk_crc = struct.pack(">I", zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        return chunk_len + chunk_type + data + chunk_crc

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    ihdr = png_chunk(b"IHDR", ihdr_data)

    raw_data = b""
    for row in pixels:
        raw_data += b"\x00"
        for color in row:
            raw_data += bytes(color)

    compressed = zlib.compress(raw_data, 9)
    idat = png_chunk(b"IDAT", compressed)
    iend = png_chunk(b"IEND", b"")

    return signature + ihdr + idat + iend


if __name__ == "__main__":
    import os

    script_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(script_dir, "icons")
    os.makedirs(icons_dir, exist_ok=True)

    for size in [16, 48, 128]:
        icon_data = create_icon_with_arrow(size)
        icon_path = os.path.join(icons_dir, f"icon{size}.png")
        with open(icon_path, "wb") as f:
            f.write(icon_data)
        print(f"Created {icon_path}")

    print("Done!")
