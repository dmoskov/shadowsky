//
// ImageCompressorModule.swift
// Image Compressor Module
//
// Expo Module for client-side image compression, resizing, and cropping
// using native iOS ImageIO and CoreGraphics APIs for hardware-accelerated
// processing. Ensures images fit within Bluesky's 1MB upload limit.
//

import CoreGraphics
import ExpoModulesCore
import Foundation
import ImageIO
import UniformTypeIdentifiers

public class ImageCompressorModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ImageCompressor")

        Events("onProgress")

        // Get image metadata (dimensions, file size, format)
        AsyncFunction("getImageInfo") { (uri: String, promise: Promise) in
            guard let url = self.resolveFileURL(uri) else {
                promise.reject("ERR_INVALID_URI", "Invalid image URI: \(uri)")
                return
            }

            guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else {
                promise.reject("ERR_READ_IMAGE", "Failed to read image at: \(uri)")
                return
            }

            guard let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] else {
                promise.reject("ERR_IMAGE_PROPS", "Failed to read image properties")
                return
            }

            let width = properties[kCGImagePropertyPixelWidth] as? Int ?? 0
            let height = properties[kCGImagePropertyPixelHeight] as? Int ?? 0

            // Determine format from UTI
            let uti = CGImageSourceGetType(source) as String? ?? "unknown"
            let format: String
            if uti.contains("jpeg") || uti.contains("jpg") {
                format = "jpeg"
            } else if uti.contains("png") {
                format = "png"
            } else if uti.contains("webp") {
                format = "webp"
            } else if uti.contains("heic") || uti.contains("heif") {
                format = "heic"
            } else {
                format = uti
            }

            // Get file size
            var fileSize: Int64 = 0
            if let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
               let size = attrs[.size] as? Int64
            {
                fileSize = size
            }

            let result: [String: Any] = [
                "width": width,
                "height": height,
                "fileSize": fileSize,
                "format": format,
            ]

            promise.resolve(result)
        }

        // Compress image to fit within target file size
        // quality: 0.0–1.0
        // maxFileSize: target max bytes (e.g. 1000000 for ~1MB)
        // maxDimension: max width/height (0 = no limit)
        // format: "jpeg" | "png" (output format)
        AsyncFunction("compressImage") {
            (uri: String, options: [String: Any], promise: Promise) in
            guard let inputURL = self.resolveFileURL(uri) else {
                promise.reject("ERR_INVALID_URI", "Invalid image URI: \(uri)")
                return
            }

            let quality = options["quality"] as? Double ?? 0.85
            let maxFileSize = options["maxFileSize"] as? Int ?? 1_000_000
            let maxDimension = options["maxDimension"] as? Int ?? 2000
            let outputFormat = options["format"] as? String ?? "jpeg"

            self.sendEvent("onProgress", ["progress": 0.1, "stage": "loading"])

            guard let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
                  let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil)
            else {
                promise.reject("ERR_READ_IMAGE", "Failed to load image")
                return
            }

            self.sendEvent("onProgress", ["progress": 0.3, "stage": "resizing"])

            // Resize if needed
            let resized = self.resizeCGImage(
                cgImage, maxDimension: maxDimension)

            self.sendEvent("onProgress", ["progress": 0.5, "stage": "compressing"])

            // Compress with progressive quality reduction to fit maxFileSize
            let result = self.compressToFit(
                image: resized,
                initialQuality: quality,
                maxFileSize: maxFileSize,
                format: outputFormat
            )

            guard let (outputURL, compressedSize) = result else {
                promise.reject(
                    "ERR_COMPRESSION",
                    "Failed to compress image within size limit")
                return
            }

            // Get original file size
            var originalSize: Int64 = 0
            if let attrs = try? FileManager.default.attributesOfItem(
                atPath: inputURL.path),
                let size = attrs[.size] as? Int64
            {
                originalSize = size
            }

            self.sendEvent("onProgress", ["progress": 1.0, "stage": "complete"])

            let response: [String: Any] = [
                "uri": outputURL.absoluteString,
                "width": resized.width,
                "height": resized.height,
                "originalSize": originalSize,
                "compressedSize": compressedSize,
                "mimeType": outputFormat == "png" ? "image/png" : "image/jpeg",
            ]

            promise.resolve(response)
        }

        // Crop image to specified region
        AsyncFunction("cropImage") {
            (uri: String, cropOptions: [String: Any], promise: Promise) in
            guard let inputURL = self.resolveFileURL(uri) else {
                promise.reject("ERR_INVALID_URI", "Invalid image URI: \(uri)")
                return
            }

            guard let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
                  let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil)
            else {
                promise.reject("ERR_READ_IMAGE", "Failed to load image")
                return
            }

            let x = cropOptions["x"] as? Int ?? 0
            let y = cropOptions["y"] as? Int ?? 0
            let width = cropOptions["width"] as? Int ?? cgImage.width
            let height = cropOptions["height"] as? Int ?? cgImage.height
            let quality = cropOptions["quality"] as? Double ?? 0.9
            let outputFormat = cropOptions["format"] as? String ?? "jpeg"

            let cropRect = CGRect(x: x, y: y, width: width, height: height)

            guard let cropped = cgImage.cropping(to: cropRect) else {
                promise.reject("ERR_CROP", "Failed to crop image with given rect")
                return
            }

            guard let outputURL = self.writeCGImage(
                cropped, quality: quality, format: outputFormat)
            else {
                promise.reject("ERR_WRITE", "Failed to write cropped image")
                return
            }

            var fileSize: Int64 = 0
            if let attrs = try? FileManager.default.attributesOfItem(
                atPath: outputURL.path),
                let size = attrs[.size] as? Int64
            {
                fileSize = size
            }

            let result: [String: Any] = [
                "uri": outputURL.absoluteString,
                "width": cropped.width,
                "height": cropped.height,
                "fileSize": fileSize,
                "mimeType": outputFormat == "png" ? "image/png" : "image/jpeg",
            ]

            promise.resolve(result)
        }

        // Resize image to fit within max dimensions (maintains aspect ratio)
        AsyncFunction("resizeImage") {
            (uri: String, options: [String: Any], promise: Promise) in
            guard let inputURL = self.resolveFileURL(uri) else {
                promise.reject("ERR_INVALID_URI", "Invalid image URI: \(uri)")
                return
            }

            guard let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
                  let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil)
            else {
                promise.reject("ERR_READ_IMAGE", "Failed to load image")
                return
            }

            let maxWidth = options["maxWidth"] as? Int ?? cgImage.width
            let maxHeight = options["maxHeight"] as? Int ?? cgImage.height
            let quality = options["quality"] as? Double ?? 0.9
            let outputFormat = options["format"] as? String ?? "jpeg"

            let maxDim = max(maxWidth, maxHeight)
            let resized = self.resizeCGImage(cgImage, maxDimension: maxDim)

            guard let outputURL = self.writeCGImage(
                resized, quality: quality, format: outputFormat)
            else {
                promise.reject("ERR_WRITE", "Failed to write resized image")
                return
            }

            var fileSize: Int64 = 0
            if let attrs = try? FileManager.default.attributesOfItem(
                atPath: outputURL.path),
                let size = attrs[.size] as? Int64
            {
                fileSize = size
            }

            let result: [String: Any] = [
                "uri": outputURL.absoluteString,
                "width": resized.width,
                "height": resized.height,
                "fileSize": fileSize,
                "mimeType": outputFormat == "png" ? "image/png" : "image/jpeg",
            ]

            promise.resolve(result)
        }

        // Clean up temporary compressed/cropped image files
        Function("cleanupTempFiles") {
            let tmpDir = FileManager.default.temporaryDirectory
            if let files = try? FileManager.default.contentsOfDirectory(
                atPath: tmpDir.path)
            {
                for file in files
                where file.hasPrefix("img_compressed_") || file.hasPrefix(
                    "img_cropped_") || file.hasPrefix("img_resized_")
                {
                    try? FileManager.default.removeItem(
                        at: tmpDir.appendingPathComponent(file))
                }
            }
        }
    }

    // MARK: - Private Helpers

    internal func resolveFileURL(_ uri: String) -> URL? {
        if uri.hasPrefix("file://") {
            return URL(string: uri)
        } else if uri.hasPrefix("/") {
            return URL(fileURLWithPath: uri)
        } else if uri.hasPrefix("ph://") {
            // Photos library asset - not directly supported
            return nil
        }
        return URL(string: uri)
    }

    /// Resize a CGImage so its longest side fits within maxDimension.
    /// Returns the original image if it already fits.
    internal func resizeCGImage(_ image: CGImage, maxDimension: Int) -> CGImage {
        let width = image.width
        let height = image.height

        guard maxDimension > 0 else { return image }
        guard width > maxDimension || height > maxDimension else { return image }

        let scale: CGFloat
        if width > height {
            scale = CGFloat(maxDimension) / CGFloat(width)
        } else {
            scale = CGFloat(maxDimension) / CGFloat(height)
        }

        let newWidth = Int(CGFloat(width) * scale)
        let newHeight = Int(CGFloat(height) * scale)

        guard
            let context = CGContext(
                data: nil,
                width: newWidth,
                height: newHeight,
                bitsPerComponent: image.bitsPerComponent,
                bytesPerRow: 0,
                space: image.colorSpace ?? CGColorSpaceCreateDeviceRGB(),
                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
            )
        else {
            return image
        }

        context.interpolationQuality = .high
        context.draw(image, in: CGRect(x: 0, y: 0, width: newWidth, height: newHeight))

        return context.makeImage() ?? image
    }

    /// Progressively compress an image to fit within maxFileSize.
    /// Tries the initial quality first, then steps down by 0.1 until it fits
    /// or reaches 0.1 quality.
    internal func compressToFit(
        image: CGImage,
        initialQuality: Double,
        maxFileSize: Int,
        format: String
    ) -> (URL, Int64)? {
        var quality = initialQuality

        while quality >= 0.1 {
            if let url = writeCGImage(image, quality: quality, format: format) {
                if let attrs = try? FileManager.default.attributesOfItem(
                    atPath: url.path),
                    let size = attrs[.size] as? Int64
                {
                    if size <= Int64(maxFileSize) {
                        return (url, size)
                    }
                    // Too large, clean up and try lower quality
                    try? FileManager.default.removeItem(at: url)
                }
            }
            quality -= 0.1
        }

        // Last resort: try minimum quality
        if let url = writeCGImage(image, quality: 0.1, format: format) {
            if let attrs = try? FileManager.default.attributesOfItem(
                atPath: url.path),
                let size = attrs[.size] as? Int64
            {
                return (url, size)
            }
        }

        return nil
    }

    /// Write a CGImage to a temporary file with the specified quality and format.
    internal func writeCGImage(
        _ image: CGImage, quality: Double, format: String
    ) -> URL? {
        let outputDir = FileManager.default.temporaryDirectory
        let ext = format == "png" ? "png" : "jpg"
        let prefix = "img_compressed_"
        let outputFilename = "\(prefix)\(UUID().uuidString).\(ext)"
        let outputURL = outputDir.appendingPathComponent(outputFilename)

        // Clean up if file already exists
        try? FileManager.default.removeItem(at: outputURL)

        let uti: CFString
        if format == "png" {
            uti = UTType.png.identifier as CFString
        } else {
            uti = UTType.jpeg.identifier as CFString
        }

        guard
            let destination = CGImageDestinationCreateWithURL(
                outputURL as CFURL, uti, 1, nil)
        else {
            return nil
        }

        let options: [CFString: Any] = [
            kCGImageDestinationLossyCompressionQuality: quality
        ]

        CGImageDestinationAddImage(destination, image, options as CFDictionary)

        guard CGImageDestinationFinalize(destination) else {
            return nil
        }

        return outputURL
    }
}
