import {
  Bold,
  Code,
  Eye,
  EyeOff,
  Italic,
  Link,
  List,
  ListOrdered,
  Type,
} from "lucide-react";
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface MarkdownComposerHandle {
  focus: () => void;
  selectionStart: number;
  selectionEnd: number;
  setSelectionRange: (start: number, end: number) => void;
}

interface MarkdownComposerProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
  showPreview?: boolean;
  onPreviewToggle?: (showPreview: boolean) => void;
}

interface FormattingButton {
  icon: React.ReactNode;
  label: string;
  prefix: string;
  suffix: string;
  blockFormat?: boolean;
}

const FORMATTING_BUTTONS: FormattingButton[] = [
  { icon: <Bold size={16} />, label: "Bold", prefix: "**", suffix: "**" },
  { icon: <Italic size={16} />, label: "Italic", prefix: "_", suffix: "_" },
  { icon: <Code size={16} />, label: "Code", prefix: "`", suffix: "`" },
  { icon: <Link size={16} />, label: "Link", prefix: "[", suffix: "](url)" },
];

const BLOCK_BUTTONS: FormattingButton[] = [
  {
    icon: <List size={16} />,
    label: "Bullet List",
    prefix: "- ",
    suffix: "",
    blockFormat: true,
  },
  {
    icon: <ListOrdered size={16} />,
    label: "Numbered List",
    prefix: "1. ",
    suffix: "",
    blockFormat: true,
  },
  {
    icon: <Type size={16} />,
    label: "Code Block",
    prefix: "```\n",
    suffix: "\n```",
    blockFormat: true,
  },
];

export function parseMarkdownToPlainText(markdown: string): string {
  let text = markdown;

  // Remove code blocks first (preserve content)
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    return match.slice(3, -3).trim();
  });

  // Remove inline code (preserve content)
  text = text.replace(/`([^`]+)`/g, "$1");

  // Remove bold (preserve content)
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");

  // Remove italic (preserve content)
  text = text.replace(/_([^_]+)_/g, "$1");
  text = text.replace(/\*([^*]+)\*/g, "$1");

  // Convert links to plain URL or text
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // Remove bullet list markers
  text = text.replace(/^- /gm, "");

  // Remove numbered list markers
  text = text.replace(/^\d+\. /gm, "");

  return text.trim();
}

export function renderMarkdownPreview(markdown: string): React.ReactNode {
  const lines = markdown.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockContent = [];
      } else {
        elements.push(
          <pre
            key={`code-${i}`}
            className="my-2 overflow-x-auto rounded-lg p-3 text-sm"
            style={{
              backgroundColor: "var(--asph-bg-tertiary)",
              color: "var(--asph-text-primary)",
            }}
          >
            <code>{codeBlockContent.join("\n")}</code>
          </pre>,
        );
        inCodeBlock = false;
        codeBlockContent = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    const renderedLine = renderInlineMarkdown(line, i);

    if (line.startsWith("- ")) {
      elements.push(
        <li key={`li-${i}`} className="ml-4 list-disc">
          {renderInlineMarkdown(line.slice(2), i)}
        </li>,
      );
    } else if (/^\d+\. /.test(line)) {
      const text = line.replace(/^\d+\. /, "");
      elements.push(
        <li key={`li-${i}`} className="ml-4 list-decimal">
          {renderInlineMarkdown(text, i)}
        </li>,
      );
    } else if (line.trim() === "") {
      elements.push(<br key={`br-${i}`} />);
    } else {
      elements.push(
        <span key={`line-${i}`}>
          {renderedLine}
          {i < lines.length - 1 && <br />}
        </span>,
      );
    }
  }

  return <>{elements}</>;
}

function renderInlineMarkdown(
  text: string,
  lineIndex: number,
): React.ReactNode {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  const patterns = [
    {
      regex: /\*\*([^*]+)\*\*/,
      component: (content: string, key: string) => (
        <strong key={key}>{content}</strong>
      ),
    },
    {
      regex: /_([^_]+)_/,
      component: (content: string, key: string) => <em key={key}>{content}</em>,
    },
    {
      regex: /`([^`]+)`/,
      component: (content: string, key: string) => (
        <code
          key={key}
          className="rounded px-1 py-0.5 text-sm"
          style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
        >
          {content}
        </code>
      ),
    },
    {
      regex: /\[([^\]]+)\]\(([^)]+)\)/,
      component: (content: string, key: string, url?: string) => (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </a>
      ),
    },
  ];

  while (remaining.length > 0) {
    let earliestMatch: {
      index: number;
      length: number;
      element: React.ReactNode;
    } | null = null;

    for (const pattern of patterns) {
      const match = remaining.match(pattern.regex);
      if (match && match.index !== undefined) {
        const index = match.index;
        if (!earliestMatch || index < earliestMatch.index) {
          let element: React.ReactNode;
          if (pattern.regex.source.includes("\\]\\(")) {
            element = pattern.component(
              match[1],
              `${lineIndex}-${keyIndex}`,
              match[2],
            );
          } else {
            element = pattern.component(match[1], `${lineIndex}-${keyIndex}`);
          }
          earliestMatch = {
            index,
            length: match[0].length,
            element,
          };
        }
      }
    }

    if (earliestMatch) {
      if (earliestMatch.index > 0) {
        elements.push(
          <span key={`text-${lineIndex}-${keyIndex++}`}>
            {remaining.slice(0, earliestMatch.index)}
          </span>,
        );
      }
      elements.push(earliestMatch.element);
      keyIndex++;
      remaining = remaining.slice(earliestMatch.index + earliestMatch.length);
    } else {
      elements.push(
        <span key={`text-${lineIndex}-${keyIndex++}`}>{remaining}</span>,
      );
      break;
    }
  }

  return elements.length === 1 ? elements[0] : <>{elements}</>;
}

export const MarkdownComposer = forwardRef<
  MarkdownComposerHandle,
  MarkdownComposerProps
>(function MarkdownComposer(
  {
    value,
    onChange,
    onKeyDown,
    onPaste,
    onFocus,
    onBlur,
    placeholder = "What's happening?",
    maxLength = 300,
    autoFocus = false,
    className = "",
    style,
    showPreview = false,
    onPreviewToggle,
  },
  ref,
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(showPreview);

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    get selectionStart() {
      return textareaRef.current?.selectionStart ?? 0;
    },
    get selectionEnd() {
      return textareaRef.current?.selectionEnd ?? 0;
    },
    setSelectionRange: (start: number, end: number) => {
      textareaRef.current?.setSelectionRange(start, end);
    },
  }));

  const applyFormatting = (button: FormattingButton) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.slice(start, end);

    let newText: string;
    let newCursorPos: number;

    if (button.blockFormat) {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const beforeLine = value.slice(0, lineStart);
      const afterStart = value.slice(lineStart);

      if (selectedText) {
        newText =
          beforeLine +
          button.prefix +
          selectedText +
          button.suffix +
          afterStart.slice(end - lineStart);
        newCursorPos =
          start +
          button.prefix.length +
          selectedText.length +
          button.suffix.length;
      } else {
        newText = beforeLine + button.prefix + afterStart;
        newCursorPos = start + button.prefix.length;
      }
    } else {
      if (selectedText) {
        newText =
          value.slice(0, start) +
          button.prefix +
          selectedText +
          button.suffix +
          value.slice(end);
        newCursorPos = end + button.prefix.length + button.suffix.length;
      } else {
        newText =
          value.slice(0, start) +
          button.prefix +
          button.suffix +
          value.slice(end);
        newCursorPos = start + button.prefix.length;
      }
    }

    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const togglePreview = () => {
    const newValue = !isPreviewMode;
    setIsPreviewMode(newValue);
    onPreviewToggle?.(newValue);
  };

  const plainTextLength = parseMarkdownToPlainText(value).length;

  return (
    <div className="w-full">
      <div
        className="mb-2 flex flex-wrap items-center gap-1 border-b pb-2"
        style={{ borderColor: "var(--asph-border-primary)" }}
      >
        {FORMATTING_BUTTONS.map((button) => (
          <button
            key={button.label}
            onClick={() => applyFormatting(button)}
            disabled={isPreviewMode}
            className="rounded p-1.5 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
            style={{ color: "var(--asph-text-secondary)" }}
            title={button.label}
          >
            {button.icon}
          </button>
        ))}

        <div
          className="mx-1 h-5 w-px"
          style={{ backgroundColor: "var(--asph-border-primary)" }}
        />

        {BLOCK_BUTTONS.map((button) => (
          <button
            key={button.label}
            onClick={() => applyFormatting(button)}
            disabled={isPreviewMode}
            className="rounded p-1.5 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-gray-800"
            style={{ color: "var(--asph-text-secondary)" }}
            title={button.label}
          >
            {button.icon}
          </button>
        ))}

        <div className="flex-1" />

        <button
          onClick={togglePreview}
          className={`flex items-center gap-1.5 rounded px-2 py-1 text-sm transition-colors ${
            isPreviewMode
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30"
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
          style={{
            color: isPreviewMode ? undefined : "var(--asph-text-secondary)",
          }}
          title={isPreviewMode ? "Edit" : "Preview"}
        >
          {isPreviewMode ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{isPreviewMode ? "Edit" : "Preview"}</span>
        </button>
      </div>

      {isPreviewMode ? (
        <div
          className={`min-h-[120px] rounded-lg border p-3 ${className}`}
          style={{
            ...style,
            backgroundColor: "var(--asph-bg-secondary)",
            borderColor: "var(--asph-border-primary)",
            color: "var(--asph-text-primary)",
          }}
        >
          {value.trim() ? (
            renderMarkdownPreview(value)
          ) : (
            <span style={{ color: "var(--asph-text-tertiary)" }}>
              Nothing to preview
            </span>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`min-h-[120px] w-full resize-none rounded-lg border px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
          style={{
            ...style,
            backgroundColor: "var(--asph-bg-secondary)",
            borderColor: "var(--asph-border-primary)",
            color: "var(--asph-text-primary)",
          }}
        />
      )}

      <div className="mt-1 flex items-center justify-between">
        <span
          className="text-xs"
          style={{ color: "var(--asph-text-tertiary)" }}
        >
          Supports **bold**, _italic_, `code`, [links](url), and more
        </span>
        <span
          className={`text-xs ${
            plainTextLength > maxLength ? "text-red-500" : ""
          }`}
          style={{
            color:
              plainTextLength <= maxLength
                ? "var(--asph-text-secondary)"
                : undefined,
          }}
        >
          {plainTextLength}/{maxLength}
        </span>
      </div>
    </div>
  );
});
