/**
 * Polyfills for APIs not yet available in Hermes (React Native JS engine).
 * Import this file at app entry before any other imports.
 */

// --- Uint8Array.fromBase64 / Uint8Array.prototype.toBase64 ---
// TC39 stage 3 proposal, used by @atproto/lex-data.
// Suppresses: "Uint8Array.fromBase64 / Uint8Array.prototype.toBase64 not available"
if (typeof Uint8Array.fromBase64 !== 'function') {
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  (Uint8Array as any).fromBase64 = function (b64: string): Uint8Array {
    // Remove padding
    const cleaned = b64.replace(/=/g, '');
    const bytes: number[] = [];
    for (let i = 0; i < cleaned.length; i += 4) {
      const a = base64Chars.indexOf(cleaned[i]);
      const b = base64Chars.indexOf(cleaned[i + 1]);
      const c = base64Chars.indexOf(cleaned[i + 2]);
      const d = base64Chars.indexOf(cleaned[i + 3]);

      bytes.push((a << 2) | (b >> 4));
      if (c !== -1) bytes.push(((b & 15) << 4) | (c >> 2));
      if (d !== -1) bytes.push(((c & 3) << 6) | d);
    }
    return new Uint8Array(bytes);
  };
}

if (typeof Uint8Array.prototype.toBase64 !== 'function') {
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  (Uint8Array.prototype as any).toBase64 = function (): string {
    const bytes = this as Uint8Array;
    let result = '';
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i];
      const b = bytes[i + 1];
      const c = bytes[i + 2];

      result += base64Chars[a >> 2];
      result += base64Chars[((a & 3) << 4) | (b !== undefined ? b >> 4 : 0)];
      result += b !== undefined ? base64Chars[((b & 15) << 2) | (c !== undefined ? c >> 6 : 0)] : '=';
      result += c !== undefined ? base64Chars[c & 63] : '=';
    }
    return result;
  };
}

// --- Intl.Segmenter polyfill ---
// Used by @atproto/lex-data for grapheme counting.
// Suppresses: "Intl.Segmenter is not available in this environment"
// Full polyfill is heavy; we provide a basic word/grapheme splitter
// that handles common cases (ASCII, basic emoji). For full Unicode
// segmentation, install 'intl-segmenter-polyfill'.
if (typeof Intl === 'undefined' || !(Intl as any).Segmenter) {
  (Intl as any).Segmenter = class Segmenter {
    private granularity: string;

    constructor(_locale?: string, options?: { granularity?: string }) {
      this.granularity = options?.granularity || 'grapheme';
    }

    segment(input: string) {
      const segments: Array<{ segment: string; index: number; input: string }> = [];

      if (this.granularity === 'grapheme') {
        // Basic grapheme splitting — handles most text correctly.
        // Does not handle complex emoji sequences (ZWJ, skin tones).
        const chars = [...input];
        let index = 0;
        for (const char of chars) {
          segments.push({ segment: char, index, input });
          index += char.length;
        }
      } else if (this.granularity === 'word') {
        const regex = /\S+/g;
        let match;
        while ((match = regex.exec(input)) !== null) {
          segments.push({ segment: match[0], index: match.index, input });
        }
      }

      return {
        [Symbol.iterator]() {
          let i = 0;
          return {
            next() {
              if (i < segments.length) {
                return { value: segments[i++], done: false };
              }
              return { value: undefined, done: true };
            },
          };
        },
      };
    }
  };
}

// --- AbortSignal.throwIfAborted / AbortSignal.timeout ---
// Used by @atproto/oauth-client. Not available in Hermes.
if (typeof AbortSignal.prototype.throwIfAborted !== "function") {
  AbortSignal.prototype.throwIfAborted = function () {
    if (this.aborted) {
      throw this.reason ?? new Error("AbortError");
    }
  };
}
if (typeof AbortSignal.timeout !== "function") {
  (AbortSignal as any).timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => {
      const err = new Error("TimeoutError");
      err.name = "TimeoutError";
      controller.abort(err);
    }, ms);
    return controller.signal;
  };
}
