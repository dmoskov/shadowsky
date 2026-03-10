import { Compass, Hash, List, Shield } from "lucide-react";
import React, { useState } from "react";
import { DiscoverFeeds } from "./discover/DiscoverFeeds";
import { DiscoverLabelers } from "./discover/DiscoverLabelers";
import { DiscoverLists } from "./discover/DiscoverLists";

type DiscoverTab = "feeds" | "lists" | "labelers";

const tabs: { key: DiscoverTab; label: string; icon: React.ElementType }[] = [
  { key: "feeds", label: "Feeds", icon: Hash },
  { key: "lists", label: "Lists", icon: List },
  { key: "labelers", label: "Labelers", icon: Shield },
];

export const Discover: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DiscoverTab>("feeds");

  return (
    <div
      className="mx-auto flex h-full max-w-4xl flex-col bg-asph-bg-primary"
      role="main"
      aria-label="Discover"
    >
      {/* Tab Navigation */}
      <div className="sticky top-0 z-10 border-b border-asph-border-primary bg-asph-bg-primary">
        <div className="flex items-center gap-2 px-4 pb-0 pt-3">
          <Compass
            className="h-5 w-5 text-asph-text-primary"
            aria-hidden="true"
          />
          <h1
            className="m-0 text-xl font-semibold text-asph-text-primary"
            id="discover-heading"
          >
            Discover
          </h1>
        </div>
        <div className="flex" role="tablist" aria-label="Discovery categories">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`discover-panel-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className="flex flex-1 items-center justify-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors"
              style={{
                borderBottomColor:
                  activeTab === tab.key ? "var(--asph-primary)" : "transparent",
                color:
                  activeTab === tab.key
                    ? "var(--asph-primary)"
                    : "var(--asph-text-secondary)",
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div
        className="asph-scrollbar flex-1 overflow-y-auto p-4"
        id={`discover-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby="discover-heading"
      >
        {activeTab === "feeds" && <DiscoverFeeds />}
        {activeTab === "lists" && <DiscoverLists />}
        {activeTab === "labelers" && <DiscoverLabelers />}
      </div>
    </div>
  );
};
