//
// VideoCompressorModule.swift
// Video Compressor Module
//
// Expo Module for hardware-accelerated video compression using AVAssetExportSession.
// Supports configurable quality presets and progress tracking.
//

import AVFoundation
import ExpoModulesCore
import Foundation

public class VideoCompressorModule: Module {
    private var currentExportSession: AVAssetExportSession?

    public func definition() -> ModuleDefinition {
        Name("VideoCompressor")

        Events("onProgress")

        // Get video metadata (duration, dimensions, file size)
        AsyncFunction("getVideoInfo") { (uri: String, promise: Promise) in
            guard let url = self.resolveFileURL(uri) else {
                promise.reject("ERR_INVALID_URI", "Invalid video URI: \(uri)")
                return
            }

            let asset = AVURLAsset(url: url, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])

            Task {
                do {
                    let duration = try await asset.load(.duration)
                    let tracks = try await asset.load(.tracks)
                    let videoTrack = tracks.first(where: { $0.mediaType == .video })

                    var width: CGFloat = 0
                    var height: CGFloat = 0
                    if let videoTrack = videoTrack {
                        let naturalSize = try await videoTrack.load(.naturalSize)
                        let transform = try await videoTrack.load(.preferredTransform)
                        let transformedSize = naturalSize.applying(transform)
                        width = abs(transformedSize.width)
                        height = abs(transformedSize.height)
                    }

                    let hasAudio = tracks.contains(where: { $0.mediaType == .audio })

                    // Get file size
                    var fileSize: Int64 = 0
                    if let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
                       let size = attrs[.size] as? Int64 {
                        fileSize = size
                    }

                    let result: [String: Any] = [
                        "duration": CMTimeGetSeconds(duration),
                        "width": Int(width),
                        "height": Int(height),
                        "fileSize": fileSize,
                        "hasAudio": hasAudio,
                    ]

                    promise.resolve(result)
                } catch {
                    promise.reject("ERR_VIDEO_INFO", "Failed to get video info: \(error.localizedDescription)")
                }
            }
        }

        // Compress video with quality preset
        // quality: "low" | "medium" | "high" | "highest"
        AsyncFunction("compressVideo") { (uri: String, quality: String, promise: Promise) in
            guard let inputURL = self.resolveFileURL(uri) else {
                promise.reject("ERR_INVALID_URI", "Invalid video URI: \(uri)")
                return
            }

            let asset = AVURLAsset(url: inputURL, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])

            // Map quality string to AVAssetExportPreset
            let preset = self.mapQualityToPreset(quality)

            guard let exportSession = AVAssetExportSession(asset: asset, presetName: preset) else {
                promise.reject("ERR_EXPORT_SESSION", "Failed to create export session. Preset '\(preset)' may not be compatible with this video.")
                return
            }

            // Generate output path
            let outputDir = FileManager.default.temporaryDirectory
            let outputFilename = "compressed_\(UUID().uuidString).mp4"
            let outputURL = outputDir.appendingPathComponent(outputFilename)

            // Clean up if file already exists
            try? FileManager.default.removeItem(at: outputURL)

            exportSession.outputURL = outputURL
            exportSession.outputFileType = .mp4
            exportSession.shouldOptimizeForNetworkUse = true

            self.currentExportSession = exportSession

            // Track progress
            let progressTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak exportSession] timer in
                guard let session = exportSession else {
                    timer.invalidate()
                    return
                }
                let progress = Double(session.progress)
                self.sendEvent("onProgress", [
                    "progress": progress,
                    "stage": "compressing",
                ])
            }

            exportSession.exportAsynchronously {
                progressTimer.invalidate()
                self.currentExportSession = nil

                switch exportSession.status {
                case .completed:
                    // Get compressed file size
                    var compressedSize: Int64 = 0
                    if let attrs = try? FileManager.default.attributesOfItem(atPath: outputURL.path),
                       let size = attrs[.size] as? Int64 {
                        compressedSize = size
                    }

                    // Get original file size
                    var originalSize: Int64 = 0
                    if let attrs = try? FileManager.default.attributesOfItem(atPath: inputURL.path),
                       let size = attrs[.size] as? Int64 {
                        originalSize = size
                    }

                    let result: [String: Any] = [
                        "uri": outputURL.absoluteString,
                        "originalSize": originalSize,
                        "compressedSize": compressedSize,
                        "mimeType": "video/mp4",
                    ]

                    self.sendEvent("onProgress", [
                        "progress": 1.0,
                        "stage": "complete",
                    ])

                    promise.resolve(result)

                case .cancelled:
                    // Clean up output file
                    try? FileManager.default.removeItem(at: outputURL)
                    promise.reject("ERR_CANCELLED", "Video compression was cancelled")

                case .failed:
                    // Clean up output file
                    try? FileManager.default.removeItem(at: outputURL)
                    let errorMsg = exportSession.error?.localizedDescription ?? "Unknown error"
                    promise.reject("ERR_COMPRESSION", "Video compression failed: \(errorMsg)")

                default:
                    try? FileManager.default.removeItem(at: outputURL)
                    promise.reject("ERR_UNKNOWN", "Unexpected export status: \(exportSession.status.rawValue)")
                }
            }
        }

        // Cancel ongoing compression
        Function("cancelCompression") {
            self.currentExportSession?.cancelExport()
            self.currentExportSession = nil
        }

        // Clean up temporary compressed files
        Function("cleanupTempFiles") {
            let tmpDir = FileManager.default.temporaryDirectory
            if let files = try? FileManager.default.contentsOfDirectory(atPath: tmpDir.path) {
                for file in files where (file.hasPrefix("compressed_") || file.hasPrefix("trimmed_")) && file.hasSuffix(".mp4") {
                    try? FileManager.default.removeItem(at: tmpDir.appendingPathComponent(file))
                }
            }
        }

        // Trim video to a time range and optionally compress
        // startTime and endTime are in seconds
        AsyncFunction("trimVideo") { (uri: String, options: [String: Any], promise: Promise) in
            guard let inputURL = self.resolveFileURL(uri) else {
                promise.reject("ERR_INVALID_URI", "Invalid video URI: \(uri)")
                return
            }

            let startTime = options["startTime"] as? Double ?? 0
            let endTime = options["endTime"] as? Double ?? 0
            let quality = options["quality"] as? String ?? "medium"

            guard endTime > startTime else {
                promise.reject("ERR_INVALID_RANGE", "endTime must be greater than startTime")
                return
            }

            let asset = AVURLAsset(url: inputURL, options: [AVURLAssetPreferPreciseDurationAndTimingKey: true])
            let preset = self.mapQualityToPreset(quality)

            guard let exportSession = AVAssetExportSession(asset: asset, presetName: preset) else {
                promise.reject("ERR_EXPORT_SESSION", "Failed to create export session for trimming")
                return
            }

            // Generate output path
            let outputDir = FileManager.default.temporaryDirectory
            let outputFilename = "trimmed_\(UUID().uuidString).mp4"
            let outputURL = outputDir.appendingPathComponent(outputFilename)

            try? FileManager.default.removeItem(at: outputURL)

            exportSession.outputURL = outputURL
            exportSession.outputFileType = .mp4
            exportSession.shouldOptimizeForNetworkUse = true

            // Set time range
            let start = CMTime(seconds: startTime, preferredTimescale: 600)
            let end = CMTime(seconds: endTime, preferredTimescale: 600)
            exportSession.timeRange = CMTimeRange(start: start, end: end)

            self.currentExportSession = exportSession

            // Track progress
            let progressTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak exportSession] timer in
                guard let session = exportSession else {
                    timer.invalidate()
                    return
                }
                self.sendEvent("onProgress", [
                    "progress": Double(session.progress),
                    "stage": "trimming",
                ])
            }

            exportSession.exportAsynchronously {
                progressTimer.invalidate()
                self.currentExportSession = nil

                switch exportSession.status {
                case .completed:
                    var compressedSize: Int64 = 0
                    if let attrs = try? FileManager.default.attributesOfItem(atPath: outputURL.path),
                       let size = attrs[.size] as? Int64 {
                        compressedSize = size
                    }

                    var originalSize: Int64 = 0
                    if let attrs = try? FileManager.default.attributesOfItem(atPath: inputURL.path),
                       let size = attrs[.size] as? Int64 {
                        originalSize = size
                    }

                    let result: [String: Any] = [
                        "uri": outputURL.absoluteString,
                        "originalSize": originalSize,
                        "compressedSize": compressedSize,
                        "duration": endTime - startTime,
                        "mimeType": "video/mp4",
                    ]

                    self.sendEvent("onProgress", [
                        "progress": 1.0,
                        "stage": "complete",
                    ])

                    promise.resolve(result)

                case .cancelled:
                    try? FileManager.default.removeItem(at: outputURL)
                    promise.reject("ERR_CANCELLED", "Video trimming was cancelled")

                case .failed:
                    try? FileManager.default.removeItem(at: outputURL)
                    let errorMsg = exportSession.error?.localizedDescription ?? "Unknown error"
                    promise.reject("ERR_TRIM", "Video trimming failed: \(errorMsg)")

                default:
                    try? FileManager.default.removeItem(at: outputURL)
                    promise.reject("ERR_UNKNOWN", "Unexpected export status: \(exportSession.status.rawValue)")
                }
            }
        }

        // Check if a preset is compatible with the video
        AsyncFunction("isPresetCompatible") { (uri: String, quality: String, promise: Promise) in
            guard let url = self.resolveFileURL(uri) else {
                promise.resolve(false)
                return
            }

            let asset = AVURLAsset(url: url)
            let preset = self.mapQualityToPreset(quality)

            AVAssetExportSession.determineCompatibility(
                ofExportPreset: preset,
                with: asset,
                outputFileType: .mp4
            ) { compatible in
                promise.resolve(compatible)
            }
        }
    }

    private func mapQualityToPreset(_ quality: String) -> String {
        switch quality.lowercased() {
        case "low":
            return AVAssetExportPresetLowQuality
        case "medium":
            return AVAssetExportPresetMediumQuality
        case "high":
            return AVAssetExportPreset1280x720
        case "highest":
            return AVAssetExportPreset1920x1080
        default:
            return AVAssetExportPresetMediumQuality
        }
    }

    private func resolveFileURL(_ uri: String) -> URL? {
        if uri.hasPrefix("file://") {
            return URL(string: uri)
        } else if uri.hasPrefix("/") {
            return URL(fileURLWithPath: uri)
        } else if uri.hasPrefix("ph://") {
            // Photos library asset - not directly supported, needs to be exported first
            return nil
        }
        return URL(string: uri)
    }
}
