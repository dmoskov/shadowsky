import {
  ArrowLeft,
  Bug,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  Keyboard,
  Layout,
  Rocket,
  Search,
  Shield,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import {
  getArticleById,
  getArticlesByCategory,
  helpCategories,
  searchHelpArticles,
  type HelpArticle,
  type HelpCategory,
} from "../../content/help";
import { useKeyboardShortcutsContext } from "../../contexts/KeyboardShortcutsContext";
import { BugReportModal } from "../feedback/BugReportModal";

const iconMap: Record<string, LucideIcon> = {
  Rocket,
  Layout,
  Keyboard,
  Wrench,
  Shield,
};

// Simple markdown-like renderer for help content
const renderContent = (content: string): React.ReactNode => {
  const lines = content.trim().split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];

  // Escape HTML entities to prevent XSS in dangerouslySetInnerHTML
  const escapeHtml = (str: string): string =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const processLine = (line: string, index: number): React.ReactNode => {
    // Headers
    if (line.startsWith("# ")) {
      return (
        <h1
          key={index}
          className="mb-4 mt-6 text-2xl font-bold first:mt-0"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          {line.slice(2)}
        </h1>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h2
          key={index}
          className="mb-3 mt-5 text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          {line.slice(3)}
        </h2>
      );
    }
    if (line.startsWith("### ")) {
      return (
        <h3
          key={index}
          className="mb-2 mt-4 text-lg font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          {line.slice(4)}
        </h3>
      );
    }

    // Escape HTML first to prevent XSS, then apply markdown formatting
    let processed = escapeHtml(line);

    // Bold text
    processed = processed.replace(
      /\*\*([^*]+)\*\*/g,
      '<strong class="font-semibold">$1</strong>',
    );

    // Links — validate URL protocol to prevent javascript: URIs
    processed = processed.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_match, text, url) => {
        const safeUrl =
          url.startsWith("http://") || url.startsWith("https://") ? url : "#";
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">${text}</a>`;
      },
    );

    // Inline code
    processed = processed.replace(
      /`([^`]+)`/g,
      '<code class="rounded bg-bsky-bg-secondary px-1.5 py-0.5 text-sm font-mono">$1</code>',
    );

    // List items
    if (line.startsWith("- ")) {
      return (
        <li
          key={index}
          className="ml-4 list-disc"
          style={{ color: "var(--bsky-text-secondary)" }}
          dangerouslySetInnerHTML={{ __html: processed.slice(2) }}
        />
      );
    }

    // Numbered list items
    const numberedMatch = line.match(/^(\d+)\. /);
    if (numberedMatch) {
      return (
        <li
          key={index}
          className="ml-4 list-decimal"
          style={{ color: "var(--bsky-text-secondary)" }}
          dangerouslySetInnerHTML={{
            __html: processed.slice(numberedMatch[0].length),
          }}
        />
      );
    }

    // Empty line
    if (line.trim() === "") {
      return <div key={index} className="h-2" />;
    }

    // Regular paragraph
    return (
      <p
        key={index}
        className="mb-2"
        style={{ color: "var(--bsky-text-secondary)" }}
        dangerouslySetInnerHTML={{ __html: processed }}
      />
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table detection
    if (line.startsWith("|") && line.endsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableHeaders = line
          .slice(1, -1)
          .split("|")
          .map((h) => h.trim());
        continue;
      }
      // Skip separator line
      if (line.includes("---")) {
        continue;
      }
      // Data row
      tableRows.push(
        line
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim()),
      );
    } else if (inTable) {
      // End of table
      elements.push(
        <div key={`table-${i}`} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {tableHeaders.map((header, idx) => (
                  <th
                    key={idx}
                    className="border px-3 py-2 text-left font-medium"
                    style={{
                      borderColor: "var(--bsky-border-primary)",
                      backgroundColor: "var(--bsky-bg-secondary)",
                      color: "var(--bsky-text-primary)",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      className="border px-3 py-2"
                      style={{
                        borderColor: "var(--bsky-border-primary)",
                        color: "var(--bsky-text-secondary)",
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      inTable = false;
      tableHeaders = [];
      tableRows = [];
      elements.push(processLine(line, i));
    } else {
      elements.push(processLine(line, i));
    }
  }

  // Handle trailing table
  if (inTable && tableRows.length > 0) {
    elements.push(
      <div key="table-final" className="my-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {tableHeaders.map((header, idx) => (
                <th
                  key={idx}
                  className="border px-3 py-2 text-left font-medium"
                  style={{
                    borderColor: "var(--bsky-border-primary)",
                    backgroundColor: "var(--bsky-bg-secondary)",
                    color: "var(--bsky-text-primary)",
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className="border px-3 py-2"
                    style={{
                      borderColor: "var(--bsky-border-primary)",
                      color: "var(--bsky-text-secondary)",
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  }

  return <div className="prose-sm">{elements}</div>;
};

interface ArticleCardProps {
  article: HelpArticle;
  onClick: () => void;
}

const ArticleCard: React.FC<ArticleCardProps> = ({ article, onClick }) => (
  <button
    onClick={onClick}
    className="w-full rounded-lg p-4 text-left transition-colors hover:bg-bsky-bg-secondary"
    style={{
      border: "1px solid var(--bsky-border-primary)",
    }}
  >
    <h3
      className="mb-1 font-medium"
      style={{ color: "var(--bsky-text-primary)" }}
    >
      {article.title}
    </h3>
    <p className="text-sm" style={{ color: "var(--bsky-text-secondary)" }}>
      {article.summary}
    </p>
  </button>
);

interface CategoryCardProps {
  category: HelpCategory;
  articleCount: number;
  onClick: () => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  articleCount,
  onClick,
}) => {
  const Icon = iconMap[category.icon] || HelpCircle;

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-lg p-4 text-left transition-colors hover:bg-bsky-bg-secondary"
      style={{
        border: "1px solid var(--bsky-border-primary)",
      }}
    >
      <div
        className="rounded-lg p-3"
        style={{ backgroundColor: "var(--bsky-bg-secondary)" }}
      >
        <Icon size={24} style={{ color: "var(--bsky-primary)" }} />
      </div>
      <div className="flex-1">
        <h3
          className="font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          {category.name}
        </h3>
        <p className="text-sm" style={{ color: "var(--bsky-text-secondary)" }}>
          {category.description}
        </p>
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          {articleCount} article{articleCount !== 1 ? "s" : ""}
        </p>
      </div>
      <ChevronRight size={20} style={{ color: "var(--bsky-text-tertiary)" }} />
    </button>
  );
};

type ViewState =
  | { type: "home" }
  | { type: "search"; query: string }
  | { type: "category"; categoryId: string }
  | { type: "article"; articleId: string };

export const HelpSettings: React.FC = () => {
  const [viewState, setViewState] = useState<ViewState>({ type: "home" });
  const [searchQuery, setSearchQuery] = useState("");
  const [isBugReportOpen, setIsBugReportOpen] = useState(false);
  const { setIsShortcutsHelpOpen } = useKeyboardShortcutsContext();

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setViewState({ type: "search", query });
    } else {
      setViewState({ type: "home" });
    }
  }, []);

  const handleBack = useCallback(() => {
    if (viewState.type === "article") {
      // Go back to category or search
      const article = getArticleById(viewState.articleId);
      if (article && searchQuery) {
        setViewState({ type: "search", query: searchQuery });
      } else if (article) {
        setViewState({ type: "category", categoryId: article.category });
      } else {
        setViewState({ type: "home" });
      }
    } else if (viewState.type === "category" || viewState.type === "search") {
      setSearchQuery("");
      setViewState({ type: "home" });
    }
  }, [viewState, searchQuery]);

  const searchResults = useMemo(() => {
    if (viewState.type === "search") {
      return searchHelpArticles(viewState.query);
    }
    return [];
  }, [viewState]);

  const categoryArticles = useMemo(() => {
    if (viewState.type === "category") {
      return getArticlesByCategory(viewState.categoryId);
    }
    return [];
  }, [viewState]);

  const currentArticle = useMemo(() => {
    if (viewState.type === "article") {
      return getArticleById(viewState.articleId);
    }
    return undefined;
  }, [viewState]);

  const currentCategory = useMemo(() => {
    if (viewState.type === "category") {
      return helpCategories.find((c) => c.id === viewState.categoryId);
    }
    if (viewState.type === "article" && currentArticle) {
      return helpCategories.find((c) => c.id === currentArticle.category);
    }
    return undefined;
  }, [viewState, currentArticle]);

  // Render article view
  if (viewState.type === "article" && currentArticle) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm transition-colors hover:text-bsky-primary"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          <ArrowLeft size={16} />
          Back to {currentCategory?.name || "Help"}
        </button>

        <div>{renderContent(currentArticle.content)}</div>

        <div
          className="mt-6 border-t pt-4"
          style={{ borderColor: "var(--bsky-border-primary)" }}
        >
          <p className="text-sm" style={{ color: "var(--bsky-text-tertiary)" }}>
            Was this article helpful? If you need more assistance, check out the{" "}
            <a
              href="https://bsky.social"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Bluesky community
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  // Render category view
  if (viewState.type === "category" && currentCategory) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm transition-colors hover:text-bsky-primary"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          <ArrowLeft size={16} />
          Back to Help
        </button>

        <div>
          <h2
            className="text-xl font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            {currentCategory.name}
          </h2>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {currentCategory.description}
          </p>
        </div>

        <div className="space-y-3">
          {categoryArticles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onClick={() =>
                setViewState({ type: "article", articleId: article.id })
              }
            />
          ))}
        </div>
      </div>
    );
  }

  // Render search results
  if (viewState.type === "search") {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm transition-colors hover:text-bsky-primary"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          <ArrowLeft size={16} />
          Back to Help
        </button>

        {/* Search input */}
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--bsky-text-tertiary)" }}
          />
          <input
            type="text"
            placeholder="Search help articles..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full rounded-lg py-3 pl-10 pr-4 text-sm"
            style={{
              backgroundColor: "var(--bsky-bg-secondary)",
              color: "var(--bsky-text-primary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
            autoFocus
          />
        </div>

        <div>
          <h2
            className="mb-3 text-lg font-semibold"
            style={{ color: "var(--bsky-text-primary)" }}
          >
            Search Results for "{searchQuery}"
          </h2>
          {searchResults.length > 0 ? (
            <div className="space-y-3">
              {searchResults.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onClick={() =>
                    setViewState({ type: "article", articleId: article.id })
                  }
                />
              ))}
            </div>
          ) : (
            <p
              className="text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              No articles found. Try different keywords.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Render home view
  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Help & Documentation
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Find answers to common questions and learn how to use ShadowSky
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--bsky-text-tertiary)" }}
        />
        <input
          type="text"
          placeholder="Search help articles..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-lg py-3 pl-10 pr-4 text-sm"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            color: "var(--bsky-text-primary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        />
      </div>

      {/* Quick Actions */}
      <div
        className="rounded-lg p-4"
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          border: "1px solid var(--bsky-border-primary)",
        }}
      >
        <h3
          className="mb-3 text-sm font-semibold uppercase tracking-wide"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsShortcutsHelpOpen(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-bsky-bg-tertiary"
            style={{
              backgroundColor: "var(--bsky-bg-primary)",
              color: "var(--bsky-text-primary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          >
            <Keyboard size={16} />
            Keyboard Shortcuts
          </button>
          <a
            href="https://bsky.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-bsky-bg-tertiary"
            style={{
              backgroundColor: "var(--bsky-bg-primary)",
              color: "var(--bsky-text-primary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          >
            <ExternalLink size={16} />
            Open Bluesky
          </a>
          <button
            onClick={() => setIsBugReportOpen(true)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-bsky-bg-tertiary"
            style={{
              backgroundColor: "var(--bsky-bg-primary)",
              color: "var(--bsky-text-primary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          >
            <Bug size={16} />
            Report Bug
          </button>
        </div>
      </div>

      {/* Categories */}
      <div>
        <h3
          className="mb-3 text-sm font-semibold uppercase tracking-wide"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          Browse by Topic
        </h3>
        <div className="space-y-3">
          {helpCategories.map((category) => {
            const articles = getArticlesByCategory(category.id);
            return (
              <CategoryCard
                key={category.id}
                category={category}
                articleCount={articles.length}
                onClick={() =>
                  setViewState({ type: "category", categoryId: category.id })
                }
              />
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div
        className="border-t pt-4"
        style={{ borderColor: "var(--bsky-border-primary)" }}
      >
        <p
          className="text-center text-sm"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          Can't find what you're looking for?{" "}
          <button
            onClick={() => setIsBugReportOpen(true)}
            className="text-blue-500 hover:underline"
          >
            Report a bug
          </button>{" "}
          or join the{" "}
          <a
            href="https://bsky.social"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Bluesky community
          </a>
          .
        </p>
      </div>

      {/* Bug Report Modal */}
      <BugReportModal
        isOpen={isBugReportOpen}
        onClose={() => setIsBugReportOpen(false)}
      />
    </div>
  );
};
