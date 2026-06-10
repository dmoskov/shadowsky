import {
  AlertCircle,
  Check,
  Copy,
  Loader,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface AltTextEditorProps {
  image: {
    file: File;
    preview: string;
    alt?: string;
  };
  onSave: (altText: string) => void;
  onCancel: () => void;
}

// Pre-defined alt text templates for common image types
const ALT_TEXT_TEMPLATES = [
  { label: "Photo of...", prefix: "Photo of " },
  { label: "Screenshot of...", prefix: "Screenshot of " },
  { label: "Diagram showing...", prefix: "Diagram showing " },
  { label: "Illustration of...", prefix: "Illustration of " },
  { label: "Chart displaying...", prefix: "Chart displaying " },
  { label: "Meme:", prefix: "Meme: " },
];

// Character limits
const MAX_ALT_TEXT_LENGTH = 1000; // Bluesky supports up to 1000 chars
const RECOMMENDED_LENGTH = 500;

export function AltTextEditor({ image, onSave, onCancel }: AltTextEditorProps) {
  const [altText, setAltText] = useState(image.alt || "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(
    null,
  );

  // Auto-generate on mount if no alt text exists
  useEffect(() => {
    if (!image.alt && !altText) {
      generateAltText();
    }
  }, []);

  // Generate alt text using AI
  const generateAltText = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setAiSuggestions([]);

    try {
      // Convert file to data URL for AI processing
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result && typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Failed to read file"));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(image.file);
      });

      // Dynamically import anthropic service
      const anthropicService = await import("../services/anthropic");
      const generatedAlt = await anthropicService.generateAltText(dataUrl);

      // Set as primary suggestion and add variations
      setAiSuggestions([generatedAlt]);
      setAltText(generatedAlt);
      setSelectedSuggestion(0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate alt text. Please enter manually.",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [image.file]);

  // Apply a template
  const applyTemplate = (prefix: string) => {
    setAltText(prefix);
    setSelectedSuggestion(null);
  };

  // Apply AI suggestion
  const applySuggestion = (suggestion: string, index: number) => {
    setAltText(suggestion);
    setSelectedSuggestion(index);
  };

  // Copy alt text to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(altText);
    } catch (_err) {
      // Clipboard API might not be available
    }
  };

  // Handle save
  const handleSave = () => {
    onSave(altText.trim());
  };

  // Character count styling
  const getCharCountStyle = () => {
    if (altText.length > MAX_ALT_TEXT_LENGTH) {
      return "text-red-500";
    }
    if (altText.length > RECOMMENDED_LENGTH) {
      return "text-orange-500";
    }
    return "";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        className="flex h-[90vh] max-h-[700px] w-full max-w-3xl flex-col overflow-hidden rounded-xl"
        style={{ backgroundColor: "var(--asph-bg-primary)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: "var(--asph-border-primary)" }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="touch-target-icon rounded-full p-2 transition-colors hover:bg-asph-bg-hover"
              style={{ color: "var(--asph-text-primary)" }}
            >
              <X size={20} />
            </button>
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Add Alt Text
            </h2>
          </div>

          <button
            onClick={handleSave}
            disabled={altText.length > MAX_ALT_TEXT_LENGTH}
            className="touch-target-sm flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--asph-primary)" }}
          >
            <Check size={16} />
            Save
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Image preview */}
          <div
            className="flex w-1/2 items-center justify-center border-r bg-black p-4"
            style={{ borderColor: "var(--asph-border-primary)" }}
          >
            <img
              src={image.preview}
              alt={altText || "Image preview"}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>

          {/* Alt text editor */}
          <div className="flex w-1/2 flex-col p-4">
            {/* AI Generate button */}
            <div className="mb-4">
              <button
                onClick={generateAltText}
                disabled={isGenerating}
                className="touch-target-sm flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors hover:bg-asph-bg-hover disabled:opacity-50"
                style={{
                  borderColor: "var(--asph-primary)",
                  color: "var(--asph-primary)",
                }}
              >
                {isGenerating ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Analyzing image...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate with AI
                  </>
                )}
              </button>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-100 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* AI Suggestions */}
            {aiSuggestions.length > 0 && (
              <div className="mb-4">
                <div
                  className="mb-2 flex items-center gap-1.5 text-xs font-medium"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  <Sparkles size={12} />
                  AI Suggestion
                </div>
                <div className="space-y-2">
                  {aiSuggestions.map((suggestion, index) => (
                    <button
                      key={`ai-suggestion-${index}-${suggestion.substring(0, 20)}`}
                      onClick={() => applySuggestion(suggestion, index)}
                      className={`touch-target w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                        selectedSuggestion === index
                          ? "ring-2 ring-blue-500"
                          : "hover:bg-asph-bg-hover"
                      }`}
                      style={{
                        borderColor:
                          selectedSuggestion === index
                            ? "var(--asph-primary)"
                            : "var(--asph-border-primary)",
                        color: "var(--asph-text-primary)",
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <button
                  onClick={generateAltText}
                  disabled={isGenerating}
                  className="touch-target-sm mt-2 flex items-center gap-1 text-xs transition-colors hover:underline"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  <RefreshCw size={12} />
                  Regenerate
                </button>
              </div>
            )}

            {/* Templates */}
            <div className="mb-4">
              <div
                className="mb-2 text-xs font-medium"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Quick templates
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALT_TEXT_TEMPLATES.map((template, index) => (
                  <button
                    key={`template-${template.label}-${index}`}
                    onClick={() => applyTemplate(template.prefix)}
                    className="touch-target-sm rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-asph-bg-hover"
                    style={{
                      borderColor: "var(--asph-border-primary)",
                      color: "var(--asph-text-secondary)",
                    }}
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Text input */}
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between">
                <label
                  className="text-sm font-medium"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  Description
                </label>
                <button
                  onClick={copyToClipboard}
                  className="touch-target-sm flex items-center gap-1 text-xs transition-colors hover:underline"
                  style={{ color: "var(--asph-text-tertiary)" }}
                >
                  <Copy size={12} />
                  Copy
                </button>
              </div>
              <textarea
                value={altText}
                onChange={(e) => {
                  setAltText(e.target.value);
                  setSelectedSuggestion(null);
                }}
                placeholder="Describe this image for people who can't see it. Include important details about what's shown."
                className="h-40 w-full resize-none rounded-lg border p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  borderColor: "var(--asph-border-primary)",
                  color: "var(--asph-text-primary)",
                }}
              />
              <div
                className={`mt-2 flex items-center justify-between text-xs ${getCharCountStyle()}`}
                style={{
                  color: getCharCountStyle()
                    ? undefined
                    : "var(--asph-text-tertiary)",
                }}
              >
                <span>
                  {altText.length > RECOMMENDED_LENGTH &&
                    altText.length <= MAX_ALT_TEXT_LENGTH &&
                    "Consider shortening for better accessibility"}
                  {altText.length > MAX_ALT_TEXT_LENGTH &&
                    "Alt text is too long"}
                </span>
                <span>
                  {altText.length} / {MAX_ALT_TEXT_LENGTH}
                </span>
              </div>
            </div>

            {/* Tips */}
            <div
              className="mt-4 rounded-lg p-3 text-xs"
              style={{
                backgroundColor: "var(--asph-bg-secondary)",
                color: "var(--asph-text-secondary)",
              }}
            >
              <div className="mb-1 font-medium">Tips for good alt text:</div>
              <ul className="list-inside list-disc space-y-0.5">
                <li>Be specific and descriptive</li>
                <li>Include text shown in the image</li>
                <li>Describe the mood or context</li>
                <li>Skip phrases like "image of" or "photo of"</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
