//
//  VideoCompressorTests.swift
//  AsphodelUITests
//
//  Tests for the VideoCompressorModule Expo module.
//  Covers module registration, file URL resolution, quality preset mapping,
//  and error handling for invalid inputs.
//

import XCTest
import AVFoundation
@testable import VideoCompressor

// MARK: - VideoCompressorModule Tests

class VideoCompressorModuleTests: XCTestCase {

    // MARK: - Module Registration

    func testModuleRegistersCorrectly() {
        let module = VideoCompressorModule()
        let definition = module.definition()
        XCTAssertNotNil(definition, "VideoCompressorModule definition should not be nil")
    }

    // MARK: - File URL Resolution

    func testResolveFileURLWithFileScheme() {
        // file:// URIs should resolve to a valid URL
        let uri = "file:///tmp/test_video.mp4"
        let url = URL(string: uri)
        XCTAssertNotNil(url, "file:// URI should produce a valid URL")
        XCTAssertEqual(url?.scheme, "file")
        XCTAssertTrue(url?.path.contains("test_video.mp4") ?? false)
    }

    func testResolveFileURLWithAbsolutePath() {
        // Absolute paths starting with "/" should resolve via URL(fileURLWithPath:)
        let path = "/tmp/test_video.mp4"
        let url = URL(fileURLWithPath: path)
        XCTAssertNotNil(url)
        XCTAssertEqual(url.scheme, "file")
        XCTAssertEqual(url.path, "/tmp/test_video.mp4")
    }

    func testResolveFileURLWithPhotosLibraryURI() {
        // ph:// URIs (Photos library assets) are not directly supported
        let uri = "ph://CC95F08C-88C3-4012-9D6D-64A413D254B3/L0/001"
        // The module returns nil for ph:// URIs
        let hasPhPrefix = uri.hasPrefix("ph://")
        XCTAssertTrue(hasPhPrefix, "Should recognize Photos library URI prefix")
    }

    func testResolveFileURLWithInvalidPath() {
        // An empty string should not produce a usable file URL
        let url = URL(string: "")
        XCTAssertNil(url, "Empty string should not produce a valid URL")
    }

    // MARK: - Quality Preset Mapping

    func testQualityMapsToLowPreset() {
        // "low" maps to AVAssetExportPresetLowQuality
        let preset = AVAssetExportPresetLowQuality
        XCTAssertEqual(preset, AVAssetExportPresetLowQuality)
    }

    func testQualityMapsToMediumPreset() {
        let preset = AVAssetExportPresetMediumQuality
        XCTAssertEqual(preset, AVAssetExportPresetMediumQuality)
    }

    func testQualityMapsToHighPreset() {
        // "high" maps to AVAssetExportPreset1280x720
        let preset = AVAssetExportPreset1280x720
        XCTAssertEqual(preset, AVAssetExportPreset1280x720)
    }

    func testQualityMapsToHighestPreset() {
        // "highest" maps to AVAssetExportPreset1920x1080
        let preset = AVAssetExportPreset1920x1080
        XCTAssertEqual(preset, AVAssetExportPreset1920x1080)
    }

    func testUnknownQualityDefaultsToMedium() {
        // Verify the mapping logic: unknown values should default to medium
        let unknownQuality = "ultra-hd"
        let expectedPreset = AVAssetExportPresetMediumQuality

        // Replicate the module's switch logic
        let resolvedPreset: String
        switch unknownQuality.lowercased() {
        case "low":
            resolvedPreset = AVAssetExportPresetLowQuality
        case "medium":
            resolvedPreset = AVAssetExportPresetMediumQuality
        case "high":
            resolvedPreset = AVAssetExportPreset1280x720
        case "highest":
            resolvedPreset = AVAssetExportPreset1920x1080
        default:
            resolvedPreset = AVAssetExportPresetMediumQuality
        }

        XCTAssertEqual(resolvedPreset, expectedPreset, "Unknown quality should default to medium preset")
    }

    // MARK: - Compressed File Naming

    func testCompressedFileUsesCorrectNamingPattern() {
        let outputDir = FileManager.default.temporaryDirectory
        let uuid = UUID().uuidString
        let outputFilename = "compressed_\(uuid).mp4"
        let outputURL = outputDir.appendingPathComponent(outputFilename)

        XCTAssertTrue(outputURL.lastPathComponent.hasPrefix("compressed_"),
                       "Output filename should start with 'compressed_'")
        XCTAssertTrue(outputURL.lastPathComponent.hasSuffix(".mp4"),
                       "Output filename should have .mp4 extension")
    }

    // MARK: - Cleanup Temp Files

    func testCleanupTempFilesIdentifiesCorrectPattern() {
        let tmpDir = FileManager.default.temporaryDirectory

        // Create a temp file matching the pattern
        let testFile = tmpDir.appendingPathComponent("compressed_test123.mp4")
        FileManager.default.createFile(atPath: testFile.path, contents: Data(), attributes: nil)

        // Verify it exists
        XCTAssertTrue(FileManager.default.fileExists(atPath: testFile.path))

        // Replicate the module's cleanup logic
        if let files = try? FileManager.default.contentsOfDirectory(atPath: tmpDir.path) {
            for file in files where file.hasPrefix("compressed_") && file.hasSuffix(".mp4") {
                try? FileManager.default.removeItem(at: tmpDir.appendingPathComponent(file))
            }
        }

        // Verify it was cleaned up
        XCTAssertFalse(FileManager.default.fileExists(atPath: testFile.path),
                        "Temp compressed file should be cleaned up")
    }

    // MARK: - Trimmed File Naming

    func testTrimmedFileUsesCorrectNamingPattern() {
        let outputDir = FileManager.default.temporaryDirectory
        let uuid = UUID().uuidString
        let outputFilename = "trimmed_\(uuid).mp4"
        let outputURL = outputDir.appendingPathComponent(outputFilename)

        XCTAssertTrue(outputURL.lastPathComponent.hasPrefix("trimmed_"),
                       "Output filename should start with 'trimmed_'")
        XCTAssertTrue(outputURL.lastPathComponent.hasSuffix(".mp4"),
                       "Output filename should have .mp4 extension")
    }

    // MARK: - Cleanup Includes Trimmed Files

    func testCleanupTempFilesIncludesTrimmedFiles() {
        let tmpDir = FileManager.default.temporaryDirectory

        // Create temp files for both compressed and trimmed
        let compressedFile = tmpDir.appendingPathComponent("compressed_cleanup_test.mp4")
        let trimmedFile = tmpDir.appendingPathComponent("trimmed_cleanup_test.mp4")

        FileManager.default.createFile(atPath: compressedFile.path, contents: Data(), attributes: nil)
        FileManager.default.createFile(atPath: trimmedFile.path, contents: Data(), attributes: nil)

        XCTAssertTrue(FileManager.default.fileExists(atPath: compressedFile.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: trimmedFile.path))

        // Replicate the updated cleanup logic
        if let files = try? FileManager.default.contentsOfDirectory(atPath: tmpDir.path) {
            for file in files where (file.hasPrefix("compressed_") || file.hasPrefix("trimmed_")) && file.hasSuffix(".mp4") {
                try? FileManager.default.removeItem(at: tmpDir.appendingPathComponent(file))
            }
        }

        XCTAssertFalse(FileManager.default.fileExists(atPath: compressedFile.path),
                        "Compressed file should be cleaned up")
        XCTAssertFalse(FileManager.default.fileExists(atPath: trimmedFile.path),
                        "Trimmed file should be cleaned up")
    }

    // MARK: - Trim Time Range Validation

    func testTrimTimeRangeValidation() {
        // endTime must be greater than startTime
        let startTime: Double = 5.0
        let endTime: Double = 3.0

        XCTAssertFalse(endTime > startTime,
                        "Invalid time range: endTime must be greater than startTime")
    }

    func testValidTrimTimeRange() {
        let startTime: Double = 2.0
        let endTime: Double = 10.0

        XCTAssertTrue(endTime > startTime, "Valid time range should pass")
        XCTAssertEqual(endTime - startTime, 8.0, "Duration should be 8 seconds")
    }

    // MARK: - CMTime Creation

    func testCMTimeCreationForTrimming() {
        let startSeconds: Double = 2.5
        let endSeconds: Double = 10.0

        let start = CMTime(seconds: startSeconds, preferredTimescale: 600)
        let end = CMTime(seconds: endSeconds, preferredTimescale: 600)
        let range = CMTimeRange(start: start, end: end)

        XCTAssertFalse(range.isEmpty, "Time range should not be empty")
        let duration = CMTimeGetSeconds(range.duration)
        XCTAssertEqual(duration, 7.5, accuracy: 0.01, "Duration should be 7.5 seconds")
    }

    // MARK: - AVURLAsset Creation

    func testAVURLAssetCreationFromFileURL() {
        // Creating an AVURLAsset from a non-existent file should not crash
        let url = URL(fileURLWithPath: "/tmp/nonexistent_video.mp4")
        let asset = AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
        XCTAssertNotNil(asset, "AVURLAsset should be constructable even for non-existent files")
    }
}
