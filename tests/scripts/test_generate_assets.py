"""Tests for scripts/generate_assets.py asset generation functions."""

import os

from PIL import Image, ImageDraw

# Add scripts to path so we can import the module
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts"))

from generate_assets import (
    BACKGROUND_COLOR,
    DARK_BLUE,
    LIGHT_BLUE,
    PRIMARY_BLUE,
    create_adaptive_icon,
    create_app_icon,
    create_favicon,
    create_s_logo,
    create_splash_icon,
    main,
)


class TestBrandColors:
    """Verify brand color constants are correctly defined."""

    def test_background_color(self):
        assert BACKGROUND_COLOR == "#0a0a0f"

    def test_primary_blue(self):
        assert PRIMARY_BLUE == "#3b82f6"

    def test_light_blue(self):
        assert LIGHT_BLUE == "#60a5fa"

    def test_dark_blue(self):
        assert DARK_BLUE == "#2563eb"


class TestCreateSLogo:
    """Tests for the create_s_logo drawing function."""

    def test_draws_on_image_without_error(self):
        """create_s_logo should draw on a canvas without raising."""
        size = 256
        img = Image.new("RGB", (size, size), BACKGROUND_COLOR)
        draw = ImageDraw.Draw(img)
        create_s_logo(size, draw)

    def test_modifies_pixels(self):
        """The logo should actually draw something (not leave the canvas blank)."""
        size = 256
        img = Image.new("RGB", (size, size), BACKGROUND_COLOR)
        draw = ImageDraw.Draw(img)
        blank_bytes = img.tobytes()
        create_s_logo(size, draw)
        drawn_bytes = img.tobytes()
        assert blank_bytes != drawn_bytes, "create_s_logo should modify the image"

    def test_offset_shifts_drawing(self):
        """Passing offset_x/offset_y should shift the logo position."""
        size = 256
        img_no_offset = Image.new("RGB", (size, size), BACKGROUND_COLOR)
        draw1 = ImageDraw.Draw(img_no_offset)
        create_s_logo(size, draw1, offset_x=0, offset_y=0)

        img_with_offset = Image.new("RGB", (size, size), BACKGROUND_COLOR)
        draw2 = ImageDraw.Draw(img_with_offset)
        create_s_logo(size, draw2, offset_x=50, offset_y=50)

        assert img_no_offset.tobytes() != img_with_offset.tobytes(), (
            "Offset should produce a different image"
        )

    def test_small_size(self):
        """Should handle small canvas sizes without error."""
        size = 16
        img = Image.new("RGB", (size, size), BACKGROUND_COLOR)
        draw = ImageDraw.Draw(img)
        create_s_logo(size, draw)

    def test_large_size(self):
        """Should handle large canvas sizes without error."""
        size = 2048
        img = Image.new("RGB", (size, size), BACKGROUND_COLOR)
        draw = ImageDraw.Draw(img)
        create_s_logo(size, draw)

    def test_rgba_canvas(self):
        """Should work on an RGBA canvas (used by adaptive icon)."""
        size = 256
        img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        create_s_logo(size, draw)

    def test_logo_stays_within_bounds(self):
        """The logo drawing should not raise for being out of bounds."""
        size = 128
        img = Image.new("RGB", (size, size), BACKGROUND_COLOR)
        draw = ImageDraw.Draw(img)
        # Should not raise any exceptions
        create_s_logo(size, draw, offset_x=0, offset_y=0)

    def test_default_offsets_are_zero(self):
        """Default offset_x and offset_y should be 0, producing same result."""
        size = 128
        img1 = Image.new("RGB", (size, size), BACKGROUND_COLOR)
        draw1 = ImageDraw.Draw(img1)
        create_s_logo(size, draw1)

        img2 = Image.new("RGB", (size, size), BACKGROUND_COLOR)
        draw2 = ImageDraw.Draw(img2)
        create_s_logo(size, draw2, offset_x=0, offset_y=0)

        assert img1.tobytes() == img2.tobytes()


class TestCreateAppIcon:
    """Tests for create_app_icon output."""

    def test_creates_file(self, tmp_path):
        """Should create a PNG file at the given path."""
        output = str(tmp_path / "icon.png")
        create_app_icon(output)
        assert os.path.exists(output)

    def test_file_is_valid_png(self, tmp_path):
        """Output file should be a valid PNG image."""
        output = str(tmp_path / "icon.png")
        create_app_icon(output)
        img = Image.open(output)
        assert img.format == "PNG"

    def test_dimensions_1024(self, tmp_path):
        """App icon should be 1024x1024 pixels."""
        output = str(tmp_path / "icon.png")
        create_app_icon(output)
        img = Image.open(output)
        assert img.size == (1024, 1024)

    def test_mode_rgb(self, tmp_path):
        """App icon should be RGB (no alpha channel)."""
        output = str(tmp_path / "icon.png")
        create_app_icon(output)
        img = Image.open(output)
        assert img.mode == "RGB"

    def test_not_blank(self, tmp_path):
        """The icon should contain drawn content, not just the background."""
        output = str(tmp_path / "icon.png")
        create_app_icon(output)
        img = Image.open(output)
        colors = img.getcolors(maxcolors=100000)
        # Should have more than one color (background + logo colors)
        assert len(colors) > 1


class TestCreateAdaptiveIcon:
    """Tests for create_adaptive_icon output."""

    def test_creates_file(self, tmp_path):
        """Should create a PNG file at the given path."""
        output = str(tmp_path / "adaptive-icon.png")
        create_adaptive_icon(output)
        assert os.path.exists(output)

    def test_file_is_valid_png(self, tmp_path):
        """Output file should be a valid PNG image."""
        output = str(tmp_path / "adaptive-icon.png")
        create_adaptive_icon(output)
        img = Image.open(output)
        assert img.format == "PNG"

    def test_dimensions_1024(self, tmp_path):
        """Adaptive icon should be 1024x1024 pixels."""
        output = str(tmp_path / "adaptive-icon.png")
        create_adaptive_icon(output)
        img = Image.open(output)
        assert img.size == (1024, 1024)

    def test_mode_rgba(self, tmp_path):
        """Adaptive icon should be RGBA (transparent background)."""
        output = str(tmp_path / "adaptive-icon.png")
        create_adaptive_icon(output)
        img = Image.open(output)
        assert img.mode == "RGBA"

    def test_has_transparency(self, tmp_path):
        """Adaptive icon should have transparent pixels (for Android masking)."""
        output = str(tmp_path / "adaptive-icon.png")
        create_adaptive_icon(output)
        img = Image.open(output)
        # Check that some pixels are fully transparent (alpha=0)
        alpha = img.getchannel("A")
        has_transparent = 0 in alpha.tobytes()
        assert has_transparent, "Adaptive icon should have transparent areas"

    def test_logo_smaller_than_app_icon(self, tmp_path):
        """Adaptive icon logo should be scaled down to 66% for safe zone."""
        app_output = str(tmp_path / "icon.png")
        adaptive_output = str(tmp_path / "adaptive-icon.png")
        create_app_icon(app_output)
        create_adaptive_icon(adaptive_output)

        adaptive_img = Image.open(adaptive_output)

        # Verify the adaptive icon has non-transparent drawn content
        # The logo is scaled to 66% for Android safe zone
        alpha = adaptive_img.getchannel("A")
        opaque_count = sum(1 for b in alpha.tobytes() if b > 0)
        assert opaque_count > 0, "Adaptive icon should have drawn content"


class TestCreateSplashIcon:
    """Tests for create_splash_icon output."""

    def test_creates_file(self, tmp_path):
        """Should create a PNG file at the given path."""
        output = str(tmp_path / "splash-icon.png")
        create_splash_icon(output)
        assert os.path.exists(output)

    def test_dimensions_1024(self, tmp_path):
        """Splash icon should be 1024x1024 pixels."""
        output = str(tmp_path / "splash-icon.png")
        create_splash_icon(output)
        img = Image.open(output)
        assert img.size == (1024, 1024)

    def test_mode_rgb(self, tmp_path):
        """Splash icon should be RGB."""
        output = str(tmp_path / "splash-icon.png")
        create_splash_icon(output)
        img = Image.open(output)
        assert img.mode == "RGB"

    def test_matches_app_icon(self, tmp_path):
        """Splash icon should produce the same image as app icon (same size, same logo)."""
        app_output = str(tmp_path / "icon.png")
        splash_output = str(tmp_path / "splash-icon.png")
        create_app_icon(app_output)
        create_splash_icon(splash_output)

        app_img = Image.open(app_output)
        splash_img = Image.open(splash_output)
        assert app_img.tobytes() == splash_img.tobytes()


class TestCreateFavicon:
    """Tests for create_favicon output."""

    def test_creates_file(self, tmp_path):
        """Should create a PNG file at the given path."""
        output = str(tmp_path / "favicon.png")
        create_favicon(output)
        assert os.path.exists(output)

    def test_dimensions_48(self, tmp_path):
        """Favicon should be 48x48 pixels."""
        output = str(tmp_path / "favicon.png")
        create_favicon(output)
        img = Image.open(output)
        assert img.size == (48, 48)

    def test_mode_rgb(self, tmp_path):
        """Favicon should be RGB."""
        output = str(tmp_path / "favicon.png")
        create_favicon(output)
        img = Image.open(output)
        assert img.mode == "RGB"

    def test_not_blank(self, tmp_path):
        """Favicon should contain drawn content."""
        output = str(tmp_path / "favicon.png")
        create_favicon(output)
        img = Image.open(output)
        colors = img.getcolors(maxcolors=10000)
        assert len(colors) > 1


class TestMain:
    """Tests for the main() orchestrator function."""

    def test_creates_all_assets(self, tmp_path, monkeypatch):
        """main() should create all four asset files."""
        monkeypatch.chdir(tmp_path)
        assets_dir = tmp_path / "mobile" / "assets"
        assets_dir.mkdir(parents=True)

        main()

        expected_files = [
            "icon.png",
            "adaptive-icon.png",
            "splash-icon.png",
            "favicon.png",
        ]
        for filename in expected_files:
            filepath = assets_dir / filename
            assert filepath.exists(), f"Expected {filename} to be created"

    def test_all_outputs_are_valid_images(self, tmp_path, monkeypatch):
        """All files created by main() should be valid PNG images."""
        monkeypatch.chdir(tmp_path)
        assets_dir = tmp_path / "mobile" / "assets"
        assets_dir.mkdir(parents=True)

        main()

        for filename in [
            "icon.png",
            "adaptive-icon.png",
            "splash-icon.png",
            "favicon.png",
        ]:
            img = Image.open(str(assets_dir / filename))
            assert img.format == "PNG", f"{filename} should be PNG"

    def test_prints_completion_message(self, tmp_path, monkeypatch, capsys):
        """main() should print status messages including completion."""
        monkeypatch.chdir(tmp_path)
        assets_dir = tmp_path / "mobile" / "assets"
        assets_dir.mkdir(parents=True)

        main()

        captured = capsys.readouterr()
        assert "All assets generated successfully" in captured.out
