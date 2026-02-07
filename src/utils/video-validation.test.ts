import { describe, expect, it } from "vitest";
import {
  getValidationErrorMessage,
  isRecoverableError,
  validateVideoFile,
  type VideoValidationError,
} from "./video-validation";

describe("validateVideoFile", () => {
  describe("MIME type validation", () => {
    it("should accept valid MP4 MIME type", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/mp4", "test.mp4");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid QuickTime MIME type", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(
        videoData,
        "video/quicktime",
        "test.mov",
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid WebM MIME type", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/webm", "test.webm");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept valid M4V MIME type", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/x-m4v", "test.m4v");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject invalid MIME type", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/avi", "test.avi");

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("INVALID_MIME_TYPE");
      expect(result.error?.message).toContain(
        "Invalid video format. Allowed formats: MP4, QuickTime (MOV), WebM, M4V",
      );
      expect(result.error?.context?.providedMimeType).toBe("video/avi");
      expect(result.error?.context?.allowedMimeTypes).toEqual([
        "video/mp4",
        "video/quicktime",
        "video/webm",
        "video/x-m4v",
      ]);
    });

    it("should reject application MIME type disguised as video", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(
        videoData,
        "application/octet-stream",
        "malicious.exe",
      );

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("INVALID_MIME_TYPE");
    });

    it("should reject text MIME type disguised as video", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "text/plain", "script.sh");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("INVALID_MIME_TYPE");
    });

    it("should reject image MIME type", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "image/jpeg", "photo.jpg");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("INVALID_MIME_TYPE");
    });
  });

  describe("file extension validation", () => {
    it("should reject .mp4 extension with mismatched MIME type", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(
        videoData,
        "video/quicktime",
        "video.mp4",
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("EXTENSION_MISMATCH");
      expect(result.error?.message).toContain(
        'File extension ".mp4" does not match MIME type "video/quicktime"',
      );
      expect(result.error?.context?.extension).toBe(".mp4");
      expect(result.error?.context?.mimeType).toBe("video/quicktime");
      expect(result.error?.context?.expectedExtensions).toEqual([".mov"]);
    });

    it("should reject .mov extension with MP4 MIME type", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/mp4", "video.mov");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("EXTENSION_MISMATCH");
      expect(result.error?.context?.expectedExtensions).toEqual([
        ".mp4",
        ".m4v",
        ".mp4v",
      ]);
    });

    it("should reject file with no extension", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/mp4", "videofile");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("EXTENSION_MISMATCH");
      expect(result.error?.context?.extension).toBe("");
    });

    it("should reject .mpeg extension with video/mp4 MIME type", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/mp4", "video.mpeg");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("EXTENSION_MISMATCH");
      expect(result.error?.context?.expectedExtensions).toEqual([
        ".mp4",
        ".m4v",
        ".mp4v",
      ]);
    });

    it("should reject malicious file disguised as video", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/mp4", "malware.exe");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("EXTENSION_MISMATCH");
    });

    it("should handle case-insensitive extensions", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/mp4", "video.MP4");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject double extension attempts", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/mp4", "video.exe.mp4");

      expect(result.valid).toBe(true);
    });

    it("should handle files with dots in the name", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(
        videoData,
        "video/mp4",
        "my.vacation.video.mp4",
      );

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("file size validation", () => {
    it("should accept file under 500MB limit", () => {
      const videoData = new Uint8Array(100 * 1024 * 1024);
      const result = validateVideoFile(videoData, "video/mp4", "video.mp4");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept file exactly at 500MB limit", () => {
      const videoData = new Uint8Array(500 * 1024 * 1024);
      const result = validateVideoFile(videoData, "video/mp4", "video.mp4");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject file over 500MB limit", () => {
      const videoData = new Uint8Array(500 * 1024 * 1024 + 1);
      const result = validateVideoFile(videoData, "video/mp4", "video.mp4");

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe("FILE_TOO_LARGE");
      expect(result.error?.message).toContain("Video file is too large");
      expect(result.error?.message).toContain("Maximum size: 500MB");
      expect(result.error?.context?.fileSize).toBe(500 * 1024 * 1024 + 1);
      expect(result.error?.context?.maxSize).toBe(500 * 1024 * 1024);
    });

    it("should reject very large file (1GB)", () => {
      const videoData = new Uint8Array(1024 * 1024 * 1024);
      const result = validateVideoFile(videoData, "video/mp4", "video.mp4");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("FILE_TOO_LARGE");
      expect(result.error?.context?.fileSizeMB).toBe(1024);
      expect(result.error?.context?.maxSizeMB).toBe(500);
    });

    it("should accept very small file (1KB)", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/mp4", "video.mp4");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept empty file (edge case)", () => {
      const videoData = new Uint8Array(0);
      const result = validateVideoFile(videoData, "video/mp4", "video.mp4");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("combined validation scenarios", () => {
    it("should check MIME type before extension", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/avi", "video.avi");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("INVALID_MIME_TYPE");
    });

    it("should check extension before size", () => {
      const videoData = new Uint8Array(600 * 1024 * 1024);
      const result = validateVideoFile(videoData, "video/mp4", "video.avi");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("EXTENSION_MISMATCH");
    });

    it("should fail on size if MIME and extension are valid", () => {
      const videoData = new Uint8Array(600 * 1024 * 1024);
      const result = validateVideoFile(videoData, "video/mp4", "video.mp4");

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("FILE_TOO_LARGE");
    });

    it("should pass all validations for valid file", () => {
      const videoData = new Uint8Array(100 * 1024 * 1024);
      const result = validateVideoFile(videoData, "video/mp4", "vacation.mp4");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("security edge cases", () => {
    it("should reject null byte injection in filename", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(
        videoData,
        "video/mp4",
        "video.mp4\0.exe",
      );

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe("EXTENSION_MISMATCH");
    });

    it("should reject path traversal attempts", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(
        videoData,
        "video/mp4",
        "../../../etc/passwd.mp4",
      );

      expect(result.valid).toBe(true);
    });

    it("should handle special characters in filename", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/mp4", "video@#$%.mp4");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should handle unicode characters in filename", () => {
      const videoData = new Uint8Array(1024);
      const result = validateVideoFile(videoData, "video/mp4", "视频文件.mp4");

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});

describe("getValidationErrorMessage", () => {
  it("should return error message for INVALID_MIME_TYPE", () => {
    const error: VideoValidationError = {
      code: "INVALID_MIME_TYPE",
      message: "Invalid video format",
    };

    expect(getValidationErrorMessage(error)).toBe("Invalid video format");
  });

  it("should return error message for EXTENSION_MISMATCH", () => {
    const error: VideoValidationError = {
      code: "EXTENSION_MISMATCH",
      message: "Extension does not match MIME type",
    };

    expect(getValidationErrorMessage(error)).toBe(
      "Extension does not match MIME type",
    );
  });

  it("should return error message for FILE_TOO_LARGE", () => {
    const error: VideoValidationError = {
      code: "FILE_TOO_LARGE",
      message: "File is too large",
    };

    expect(getValidationErrorMessage(error)).toBe("File is too large");
  });
});

describe("isRecoverableError", () => {
  it("should return true for FILE_TOO_LARGE", () => {
    const error: VideoValidationError = {
      code: "FILE_TOO_LARGE",
      message: "File is too large",
    };

    expect(isRecoverableError(error)).toBe(true);
  });

  it("should return false for INVALID_MIME_TYPE", () => {
    const error: VideoValidationError = {
      code: "INVALID_MIME_TYPE",
      message: "Invalid MIME type",
    };

    expect(isRecoverableError(error)).toBe(false);
  });

  it("should return false for EXTENSION_MISMATCH", () => {
    const error: VideoValidationError = {
      code: "EXTENSION_MISMATCH",
      message: "Extension mismatch",
    };

    expect(isRecoverableError(error)).toBe(false);
  });

  it("should return false for INVALID_FILE", () => {
    const error: VideoValidationError = {
      code: "INVALID_FILE",
      message: "Invalid file",
    };

    expect(isRecoverableError(error)).toBe(false);
  });
});
