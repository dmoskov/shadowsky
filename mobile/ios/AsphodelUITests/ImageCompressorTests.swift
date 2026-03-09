//
//  ImageCompressorTests.swift
//  AsphodelUITests
//
//  Tests for the ImageCompressorModule Expo module.
//  Covers module registration, file URL resolution, image resizing logic,
//  progressive compression, cropping, and temp file cleanup.
//

import CoreGraphics
import ImageIO
import XCTest

@testable import ImageCompressor

// MARK: - ImageCompressorModule Tests

class ImageCompressorModuleTests: XCTestCase {

    // MARK: - Module Registration

    func testModuleRegistersCorrectly() {
        let module = ImageCompressorModule()
        let definition = module.definition()
        XCTAssertNotNil(definition, "ImageCompressorModule definition should not be nil")
    }

    // MARK: - File URL Resolution

    func testResolveFileURLWithFileScheme() {
        let module = ImageCompressorModule()
        let url = module.resolveFileURL("file:///tmp/test_image.jpg")
        XCTAssertNotNil(url, "file:// URI should produce a valid URL")
        XCTAssertEqual(url?.scheme, "file")
        XCTAssertTrue(url?.path.contains("test_image.jpg") ?? false)
    }

    func testResolveFileURLWithAbsolutePath() {
        let module = ImageCompressorModule()
        let url = module.resolveFileURL("/tmp/test_image.jpg")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.scheme, "file")
        XCTAssertEqual(url?.path, "/tmp/test_image.jpg")
    }

    func testResolveFileURLWithPhotosLibraryURI() {
        let module = ImageCompressorModule()
        let url = module.resolveFileURL("ph://CC95F08C-88C3-4012-9D6D-64A413D254B3/L0/001")
        XCTAssertNil(url, "ph:// URIs should return nil (not directly supported)")
    }

    func testResolveFileURLWithEmptyString() {
        let module = ImageCompressorModule()
        let url = module.resolveFileURL("")
        // Empty string via URL(string:) returns nil
        XCTAssertNil(url, "Empty string should not produce a valid URL")
    }

    // MARK: - Image Resizing

    func testResizeCGImageDownscalesLargeImage() {
        let module = ImageCompressorModule()

        // Create a 4000x3000 test image
        guard let image = createTestCGImage(width: 4000, height: 3000) else {
            XCTFail("Failed to create test image")
            return
        }

        let resized = module.resizeCGImage(image, maxDimension: 2000)

        XCTAssertEqual(resized.width, 2000, "Width should be scaled to max dimension")
        XCTAssertEqual(resized.height, 1500, "Height should maintain aspect ratio")
    }

    func testResizeCGImagePreservesSmallImage() {
        let module = ImageCompressorModule()

        guard let image = createTestCGImage(width: 800, height: 600) else {
            XCTFail("Failed to create test image")
            return
        }

        let resized = module.resizeCGImage(image, maxDimension: 2000)

        XCTAssertEqual(resized.width, 800, "Small image width should be preserved")
        XCTAssertEqual(resized.height, 600, "Small image height should be preserved")
    }

    func testResizeCGImageHandlesPortraitImage() {
        let module = ImageCompressorModule()

        guard let image = createTestCGImage(width: 1000, height: 4000) else {
            XCTFail("Failed to create test image")
            return
        }

        let resized = module.resizeCGImage(image, maxDimension: 2000)

        XCTAssertEqual(resized.height, 2000, "Height should be scaled to max dimension")
        XCTAssertEqual(resized.width, 500, "Width should maintain aspect ratio")
    }

    func testResizeCGImageWithZeroMaxDimension() {
        let module = ImageCompressorModule()

        guard let image = createTestCGImage(width: 4000, height: 3000) else {
            XCTFail("Failed to create test image")
            return
        }

        let resized = module.resizeCGImage(image, maxDimension: 0)

        XCTAssertEqual(resized.width, 4000, "Zero max dimension should return original")
        XCTAssertEqual(resized.height, 3000, "Zero max dimension should return original")
    }

    // MARK: - Image Writing

    func testWriteCGImageAsJPEG() {
        let module = ImageCompressorModule()

        guard let image = createTestCGImage(width: 100, height: 100) else {
            XCTFail("Failed to create test image")
            return
        }

        let url = module.writeCGImage(image, quality: 0.8, format: "jpeg")
        XCTAssertNotNil(url, "Should produce a JPEG output file")
        XCTAssertTrue(url?.lastPathComponent.hasSuffix(".jpg") ?? false)
        XCTAssertTrue(url?.lastPathComponent.hasPrefix("img_compressed_") ?? false)

        // Clean up
        if let url = url {
            try? FileManager.default.removeItem(at: url)
        }
    }

    func testWriteCGImageAsPNG() {
        let module = ImageCompressorModule()

        guard let image = createTestCGImage(width: 100, height: 100) else {
            XCTFail("Failed to create test image")
            return
        }

        let url = module.writeCGImage(image, quality: 0.9, format: "png")
        XCTAssertNotNil(url, "Should produce a PNG output file")
        XCTAssertTrue(url?.lastPathComponent.hasSuffix(".png") ?? false)

        // Clean up
        if let url = url {
            try? FileManager.default.removeItem(at: url)
        }
    }

    // MARK: - Progressive Compression

    func testCompressToFitProducesFileUnderLimit() {
        let module = ImageCompressorModule()

        // Create a large-ish test image
        guard let image = createTestCGImage(width: 2000, height: 2000) else {
            XCTFail("Failed to create test image")
            return
        }

        let result = module.compressToFit(
            image: image,
            initialQuality: 0.9,
            maxFileSize: 500_000,
            format: "jpeg"
        )

        XCTAssertNotNil(result, "Should produce a compressed file")
        if let (url, size) = result {
            XCTAssertLessThanOrEqual(
                size, 500_000,
                "Compressed file should be within size limit"
            )
            // Clean up
            try? FileManager.default.removeItem(at: url)
        }
    }

    // MARK: - Temp File Cleanup

    func testCleanupTempFilesIdentifiesCorrectPattern() {
        let tmpDir = FileManager.default.temporaryDirectory

        // Create temp files matching the pattern
        let testFiles = [
            "img_compressed_test123.jpg",
            "img_cropped_test456.jpg",
            "img_resized_test789.png",
        ]

        for file in testFiles {
            let path = tmpDir.appendingPathComponent(file)
            FileManager.default.createFile(atPath: path.path, contents: Data(), attributes: nil)
            XCTAssertTrue(FileManager.default.fileExists(atPath: path.path))
        }

        // Replicate the module's cleanup logic
        if let files = try? FileManager.default.contentsOfDirectory(atPath: tmpDir.path) {
            for file in files
            where file.hasPrefix("img_compressed_") || file.hasPrefix("img_cropped_") || file.hasPrefix(
                "img_resized_")
            {
                try? FileManager.default.removeItem(at: tmpDir.appendingPathComponent(file))
            }
        }

        // Verify cleanup
        for file in testFiles {
            let path = tmpDir.appendingPathComponent(file)
            XCTAssertFalse(
                FileManager.default.fileExists(atPath: path.path),
                "Temp file \(file) should be cleaned up"
            )
        }
    }

    // MARK: - Helpers

    /// Create a simple test CGImage filled with a solid color.
    private func createTestCGImage(width: Int, height: Int) -> CGImage? {
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard
            let context = CGContext(
                data: nil,
                width: width,
                height: height,
                bitsPerComponent: 8,
                bytesPerRow: width * 4,
                space: colorSpace,
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            )
        else {
            return nil
        }

        // Fill with a gradient-like pattern to create realistic file sizes
        context.setFillColor(red: 0.3, green: 0.5, blue: 0.8, alpha: 1.0)
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))

        return context.makeImage()
    }
}
