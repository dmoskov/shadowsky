import { Columns, Database, FileText } from "lucide-react";
import React, { useState } from "react";
import { BookmarkStorageSettings } from "./BookmarkStorageSettings";
import { ColumnStorageSettings } from "./ColumnStorageSettings";
import { DraftStorageSettings } from "./DraftStorageSettings";

export const DataSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState("bookmarks");

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Data Storage Settings</h1>
        <p className="text-muted-foreground mt-2">
          Choose how your data is stored - locally on your device or synced
          across devices using AT Protocol.
        </p>
      </div>

      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setActiveTab("bookmarks")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
            activeTab === "bookmarks"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary hover:bg-secondary/80"
          }`}
        >
          <Database className="h-4 w-4" />
          <span>Bookmarks</span>
        </button>
        <button
          onClick={() => setActiveTab("columns")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
            activeTab === "columns"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary hover:bg-secondary/80"
          }`}
        >
          <Columns className="h-4 w-4" />
          <span>Home Columns</span>
        </button>
        <button
          onClick={() => setActiveTab("drafts")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${
            activeTab === "drafts"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary hover:bg-secondary/80"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Post Drafts</span>
        </button>
      </div>

      {activeTab === "bookmarks" && (
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <BookmarkStorageSettings />
        </div>
      )}

      {activeTab === "columns" && (
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <ColumnStorageSettings />
        </div>
      )}

      {activeTab === "drafts" && (
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--bsky-bg-secondary)",
            border: "1px solid var(--bsky-border-primary)",
          }}
        >
          <DraftStorageSettings />
        </div>
      )}
    </div>
  );
};
