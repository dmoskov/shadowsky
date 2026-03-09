export {
  getVideoInfo,
  compressVideo,
  trimVideo,
  cancelCompression,
  cleanupTempFiles,
  isPresetCompatible,
  onCompressionProgress,
} from "./src/VideoCompressor";

export type {
  VideoInfo,
  CompressionResult,
  CompressionProgress,
  CompressionQuality,
  TrimOptions,
  TrimResult,
} from "./src/VideoCompressor";
