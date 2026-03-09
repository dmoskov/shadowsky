export {
  getImageInfo,
  compressImage,
  cropImage,
  resizeImage,
  cleanupTempFiles,
  onCompressionProgress,
} from "./src/ImageCompressor";

export type {
  ImageInfo,
  CompressOptions,
  CompressionResult,
  CropOptions,
  CropResult,
  ResizeOptions,
  ResizeResult,
  ImageCompressionProgress,
} from "./src/ImageCompressor";
