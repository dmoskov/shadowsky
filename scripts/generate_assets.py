#!/usr/bin/env python3
"""
Generate branded assets for ShadowSky mobile app.
Creates icon.png, adaptive-icon.png, splash-icon.png, and favicon.png
"""

from dataclasses import dataclass

from PIL import Image, ImageDraw

# Brand colors
BACKGROUND_COLOR = "#0a0a0f"
PRIMARY_BLUE = "#3b82f6"
LIGHT_BLUE = "#60a5fa"
DARK_BLUE = "#2563eb"


@dataclass
class LogoGeometry:
    """Precomputed geometry for the S logo."""

    center_x: float
    center_y: float
    width: float
    height: float
    thickness: float
    left: float
    right: float
    top: float
    bottom: float
    mid_y: float


def _compute_logo_geometry(
    size: int, offset_x: int = 0, offset_y: int = 0
) -> LogoGeometry:
    """Compute the shared dimensions and bounds for the S logo."""
    center_x = size // 2 + offset_x
    center_y = size // 2 + offset_y
    width = size * 0.55
    height = size * 0.75
    thickness = size * 0.14
    left = center_x - width / 2
    right = center_x + width / 2
    top = center_y - height / 2
    bottom = center_y + height / 2
    return LogoGeometry(
        center_x=center_x,
        center_y=center_y,
        width=width,
        height=height,
        thickness=thickness,
        left=left,
        right=right,
        top=top,
        bottom=bottom,
        mid_y=center_y,
    )


def _draw_top_section(draw: ImageDraw.Draw, g: LogoGeometry) -> None:
    """Draw the top curve, upper-right bar, and top-right cap of the S."""
    top_circle_y = g.top + g.thickness
    draw.ellipse(
        [(g.left, top_circle_y - g.thickness), (g.right, top_circle_y + g.thickness)],
        fill=PRIMARY_BLUE,
    )
    draw.rectangle(
        [(g.right - g.thickness, g.top), (g.right, g.mid_y - g.thickness / 2)],
        fill=PRIMARY_BLUE,
    )
    draw.ellipse(
        [
            (g.right - g.thickness * 2, g.top - g.thickness / 2),
            (g.right, g.top + g.thickness * 1.5),
        ],
        fill=PRIMARY_BLUE,
    )


def _draw_middle_section(draw: ImageDraw.Draw, g: LogoGeometry) -> None:
    """Draw the middle transition connecting the top and bottom curves."""
    mid_bar_width = g.width * 0.7
    mid_bar_left = g.center_x - mid_bar_width / 2
    mid_bar_right = g.center_x + mid_bar_width / 2
    draw.ellipse(
        [
            (mid_bar_left - g.thickness / 2, g.mid_y - g.thickness),
            (mid_bar_right + g.thickness / 2, g.mid_y + g.thickness),
        ],
        fill=PRIMARY_BLUE,
    )


def _draw_bottom_section(draw: ImageDraw.Draw, g: LogoGeometry) -> None:
    """Draw the bottom curve, lower-left bar, and bottom-left cap of the S."""
    bottom_circle_y = g.bottom - g.thickness
    draw.ellipse(
        [
            (g.left, bottom_circle_y - g.thickness),
            (g.right, bottom_circle_y + g.thickness),
        ],
        fill=PRIMARY_BLUE,
    )
    draw.rectangle(
        [(g.left, g.mid_y + g.thickness / 2), (g.left + g.thickness, g.bottom)],
        fill=PRIMARY_BLUE,
    )
    draw.ellipse(
        [
            (g.left, g.bottom - g.thickness * 1.5),
            (g.left + g.thickness * 2, g.bottom + g.thickness / 2),
        ],
        fill=PRIMARY_BLUE,
    )


def _draw_highlights(draw: ImageDraw.Draw, g: LogoGeometry, size: int) -> None:
    """Draw subtle glow/highlight outlines on the top and bottom curves."""
    glow_offset = int(size * 0.008)
    highlight_width = max(1, int(g.thickness * 0.15))
    top_circle_y = g.top + g.thickness
    bottom_circle_y = g.bottom - g.thickness

    draw.ellipse(
        [
            (g.left - glow_offset, top_circle_y - g.thickness - glow_offset),
            (g.right - glow_offset, top_circle_y + g.thickness - glow_offset),
        ],
        outline=LIGHT_BLUE,
        width=highlight_width,
    )
    draw.ellipse(
        [
            (g.left + glow_offset, bottom_circle_y - g.thickness + glow_offset),
            (g.right + glow_offset, bottom_circle_y + g.thickness + glow_offset),
        ],
        outline=LIGHT_BLUE,
        width=highlight_width,
    )


def create_s_logo(
    size: int, draw: ImageDraw.Draw, offset_x: int = 0, offset_y: int = 0
):
    """
    Create a stylized 'S' logo - clean geometric design.
    The S is made from two crescents creating a flowing shape.
    """
    g = _compute_logo_geometry(size, offset_x, offset_y)
    _draw_top_section(draw, g)
    _draw_middle_section(draw, g)
    _draw_bottom_section(draw, g)
    _draw_highlights(draw, g, size)


def create_app_icon(output_path: str):
    """Create the main app icon (1024x1024px)"""
    size = 1024
    img = Image.new("RGB", (size, size), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(img)

    create_s_logo(size, draw)

    img.save(output_path, "PNG")
    print(f"✓ Created {output_path}")


def create_adaptive_icon(output_path: str):
    """Create Android adaptive icon foreground (1024x1024px)"""
    # Adaptive icons need to account for safe zone (66% of the canvas)
    # So we make the logo slightly smaller
    size = 1024
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))  # Transparent background
    draw = ImageDraw.Draw(img)

    # Scale down logo to fit in safe zone (center 66%)
    create_s_logo(int(size * 0.66), draw, 0, 0)

    img.save(output_path, "PNG")
    print(f"✓ Created {output_path}")


def create_splash_icon(output_path: str):
    """Create splash screen icon (larger, centered on dark background)"""
    size = 1024
    img = Image.new("RGB", (size, size), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(img)

    # Same size as app icon for splash
    create_s_logo(size, draw)

    img.save(output_path, "PNG")
    print(f"✓ Created {output_path}")


def create_favicon(output_path: str):
    """Create web favicon (48x48px)"""
    size = 48
    img = Image.new("RGB", (size, size), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(img)

    # Simplified logo for small size
    create_s_logo(size, draw)

    img.save(output_path, "PNG")
    print(f"✓ Created {output_path}")


def main():
    """Generate all assets"""
    base_path = "mobile/assets"

    print("Generating ShadowSky branded assets...")
    print(f"Colors: Background={BACKGROUND_COLOR}, Primary={PRIMARY_BLUE}")
    print()

    create_app_icon(f"{base_path}/icon.png")
    create_adaptive_icon(f"{base_path}/adaptive-icon.png")
    create_splash_icon(f"{base_path}/splash-icon.png")
    create_favicon(f"{base_path}/favicon.png")

    print()
    print("✓ All assets generated successfully!")


if __name__ == "__main__":
    main()
