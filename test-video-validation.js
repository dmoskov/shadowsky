// Quick validation test
const ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
];

const MIME_TO_EXTENSIONS = {
  "video/mp4": [".mp4", ".mpeg"],
  "video/quicktime": [".mov"],
  "video/webm": [".webm"],
  "video/x-m4v": [".m4v"],
};

const MAX_FILE_SIZE = 500 * 1024 * 1024;

function getFileExtension(filename) {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}

function isAllowedMimeType(mimeType) {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

function extensionMatchesMimeType(filename, mimeType) {
  const extension = getFileExtension(filename);
  if (!extension) return false;
  const allowedExtensions = MIME_TO_EXTENSIONS[mimeType];
  if (!allowedExtensions) return false;
  return allowedExtensions.includes(extension);
}

// Test cases
const tests = [
  // Valid cases
  {
    mimeType: "video/mp4",
    filename: "test.mp4",
    size: 100 * 1024 * 1024,
    expected: true,
  },
  {
    mimeType: "video/quicktime",
    filename: "test.mov",
    size: 100 * 1024 * 1024,
    expected: true,
  },
  {
    mimeType: "video/webm",
    filename: "test.webm",
    size: 100 * 1024 * 1024,
    expected: true,
  },
  {
    mimeType: "video/x-m4v",
    filename: "test.m4v",
    size: 100 * 1024 * 1024,
    expected: true,
  },

  // Invalid MIME type
  {
    mimeType: "video/avi",
    filename: "test.avi",
    size: 100 * 1024 * 1024,
    expected: false,
  },
  {
    mimeType: "video/ogg",
    filename: "test.ogg",
    size: 100 * 1024 * 1024,
    expected: false,
  },

  // Extension mismatch (security issue)
  {
    mimeType: "video/mp4",
    filename: "malware.exe",
    size: 100 * 1024 * 1024,
    expected: false,
  },
  {
    mimeType: "video/mp4",
    filename: "script.js",
    size: 100 * 1024 * 1024,
    expected: false,
  },

  // File too large
  {
    mimeType: "video/mp4",
    filename: "test.mp4",
    size: 600 * 1024 * 1024,
    expected: false,
  },
];

console.log("Running validation tests...\n");
let passed = 0;
let failed = 0;

for (const test of tests) {
  const mimeTypeValid = isAllowedMimeType(test.mimeType);
  const extensionValid = extensionMatchesMimeType(test.filename, test.mimeType);
  const sizeValid = test.size <= MAX_FILE_SIZE;
  const valid = mimeTypeValid && extensionValid && sizeValid;

  const result = valid === test.expected ? "✓ PASS" : "✗ FAIL";
  const _status = valid === test.expected ? passed++ : failed++;

  console.log(
    `${result}: ${test.mimeType} | ${test.filename} | ${Math.round(test.size / (1024 * 1024))}MB`,
  );
  if (valid !== test.expected) {
    console.log(`  Expected: ${test.expected}, Got: ${valid}`);
    console.log(
      `  MIME valid: ${mimeTypeValid}, Extension valid: ${extensionValid}, Size valid: ${sizeValid}`,
    );
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
