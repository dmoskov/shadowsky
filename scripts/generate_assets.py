#!/usr/bin/env python3
"""
Generate branded assets for ShadowSky mobile app.
Creates icon.png, adaptive-icon.png, splash-icon.png, and favicon.png
"""

from PIL import Image, ImageDraw
import math

# Brand colors
BACKGROUND_COLOR = "#0a0a0f"
PRIMARY_BLUE = "#3b82f6"
LIGHT_BLUE = "#60a5fa"
DARK_BLUE = "#2563eb"


def create_s_logo(size: int, draw: ImageDraw.Draw, offset_x: int = 0, offset_y: int = 0):
    """
    Create a stylized 'S' logo - clean geometric design.
    The S is made from two crescents creating a flowing shape.
    """
    center_x = size // 2 + offset_x
    center_y = size // 2 + offset_y

    # Dimensions
    width = size * 0.55
    height = size * 0.75
    thickness = size * 0.14

    # Calculate bounds
    left = center_x - width / 2
    right = center_x + width / 2
    top = center_y - height / 2
    bottom = center_y + height / 2
    mid_y = center_y

    # Create S using two rounded shapes
    # Top curve - from top-right, curving to middle-left
    top_curve_height = (bottom - top) * 0.52

    # Draw filled circles and rectangles to create smooth S shape
    # Top section
    top_circle_y = top + thickness
    draw.ellipse(
        [(left, top_circle_y - thickness),
         (right, top_circle_y + thickness)],
        fill=PRIMARY_BLUE
    )

    # Upper right vertical bar
    draw.rectangle(
        [(right - thickness, top),
         (right, mid_y - thickness / 2)],
        fill=PRIMARY_BLUE
    )

    # Top right cap
    draw.ellipse(
        [(right - thickness * 2, top - thickness / 2),
         (right, top + thickness * 1.5)],
        fill=PRIMARY_BLUE
    )

    # Middle transition - diagonal section
    mid_bar_width = width * 0.7
    mid_bar_left = center_x - mid_bar_width / 2
    mid_bar_right = center_x + mid_bar_width / 2

    draw.ellipse(
        [(mid_bar_left - thickness / 2, mid_y - thickness),
         (mid_bar_right + thickness / 2, mid_y + thickness)],
        fill=PRIMARY_BLUE
    )

    # Bottom section
    bottom_circle_y = bottom - thickness
    draw.ellipse(
        [(left, bottom_circle_y - thickness),
         (right, bottom_circle_y + thickness)],
        fill=PRIMARY_BLUE
    )

    # Lower left vertical bar
    draw.rectangle(
        [(left, mid_y + thickness / 2),
         (left + thickness, bottom)],
        fill=PRIMARY_BLUE
    )

    # Bottom left cap
    draw.ellipse(
        [(left, bottom - thickness * 1.5),
         (left + thickness * 2, bottom + thickness / 2)],
        fill=PRIMARY_BLUE
    )

    # Add subtle glow/highlight effect
    glow_offset = int(size * 0.008)

    # Top section highlight
    draw.ellipse(
        [(left - glow_offset, top_circle_y - thickness - glow_offset),
         (right - glow_offset, top_circle_y + thickness - glow_offset)],
        outline=LIGHT_BLUE,
        width=max(1, int(thickness * 0.15))
    )

    # Bottom section highlight
    draw.ellipse(
        [(left + glow_offset, bottom_circle_y - thickness + glow_offset),
         (right + glow_offset, bottom_circle_y + thickness + glow_offset)],
        outline=LIGHT_BLUE,
        width=max(1, int(thickness * 0.15))
    )


def create_app_icon(output_path: str):
    """Create the main app icon (1024x1024px)"""
    size = 1024
    img = Image.new('RGB', (size, size), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(img)

    create_s_logo(size, draw)

    img.save(output_path, 'PNG')
    print(f"✓ Created {output_path}")


def create_adaptive_icon(output_path: str):
    """Create Android adaptive icon foreground (1024x1024px)"""
    # Adaptive icons need to account for safe zone (66% of the canvas)
    # So we make the logo slightly smaller
    size = 1024
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))  # Transparent background
    draw = ImageDraw.Draw(img)

    # Scale down logo to fit in safe zone (center 66%)
    create_s_logo(int(size * 0.66), draw, 0, 0)

    img.save(output_path, 'PNG')
    print(f"✓ Created {output_path}")


def create_splash_icon(output_path: str):
    """Create splash screen icon (larger, centered on dark background)"""
    size = 1024
    img = Image.new('RGB', (size, size), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(img)

    # Same size as app icon for splash
    create_s_logo(size, draw)

    img.save(output_path, 'PNG')
    print(f"✓ Created {output_path}")


def create_favicon(output_path: str):
    """Create web favicon (48x48px)"""
    size = 48
    img = Image.new('RGB', (size, size), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(img)

    # Simplified logo for small size
    create_s_logo(size, draw)

    img.save(output_path, 'PNG')
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
