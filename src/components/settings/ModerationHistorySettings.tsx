import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  Flag,
  Search,
  Trash2,
  VolumeX,
  X,
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";
import {
  type BlockHistoryEntry,
  type ModerationActionType,
  type ModerationHistoryFilter,
  type MuteHistoryEntry,
  type ReportHistoryEntry,
  moderationHistoryDB,
} from "../../services/moderation-history-db";

type SortField = "createdAt" | "handle";
type SortDirection = "asc" | "desc";

export const ModerationHistorySettings: React.FC = () => {
  const queryClient = useQueryClient();

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ModerationActionType | "all">(
    "all",
  );
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Date filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["moderationHistoryStats"],
    queryFn: async () => {
      await moderationHistoryDB.init();
      return moderationHistoryDB.getStats();
    },
  });

  // Build filter from state
  const currentFilter = useMemo((): ModerationHistoryFilter => {
    return {
      type: activeTab === "all" ? undefined : activeTab,
      searchQuery: searchQuery || undefined,
      startDate: startDate ? new Date(startDate).getTime() : undefined,
      endDate: endDate
        ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000
        : undefined,
      activeOnly,
    };
  }, [activeTab, searchQuery, startDate, endDate, activeOnly]);

  // Fetch history data
  const { data: historyData, isLoading } = useQuery({
    queryKey: ["moderationHistory", currentFilter],
    queryFn: async () => {
      await moderationHistoryDB.init();
      return moderationHistoryDB.searchHistory(currentFilter);
    },
  });

  // Sort the data
  const sortedData = useMemo(() => {
    if (!historyData) return { blocks: [], mutes: [], reports: [] };

    const sortFn = <T extends { createdAt: number; subjectHandle?: string }>(
      a: T,
      b: T,
    ) => {
      let comparison = 0;
      if (sortField === "createdAt") {
        comparison = a.createdAt - b.createdAt;
      } else if (sortField === "handle") {
        comparison = (a.subjectHandle || "").localeCompare(
          b.subjectHandle || "",
        );
      }
      return sortDirection === "asc" ? comparison : -comparison;
    };

    return {
      blocks: [...historyData.blocks].sort(sortFn),
      mutes: [...historyData.mutes].sort(sortFn),
      reports: [
        ...(historyData.reports as (ReportHistoryEntry & {
          subjectHandle?: string;
        })[]),
      ].sort(sortFn),
    };
  }, [historyData, sortField, sortDirection]);

  // Calculate total items for display
  const totalItems =
    sortedData.blocks.length +
    sortedData.mutes.length +
    sortedData.reports.length;

  // Handle clear all history
  const handleClearHistory = useCallback(async () => {
    if (
      window.confirm(
        "Are you sure you want to clear all moderation history? This cannot be undone.",
      )
    ) {
      await moderationHistoryDB.clearAll();
      queryClient.invalidateQueries({ queryKey: ["moderationHistory"] });
      queryClient.invalidateQueries({ queryKey: ["moderationHistoryStats"] });
    }
  }, [queryClient]);

  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format relative time
  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days > 30) {
      return formatDate(timestamp);
    }
    if (days > 0) {
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    }
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  };

  // Toggle sort
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Render sort indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp size={14} />
    ) : (
      <ChevronDown size={14} />
    );
  };

  // Render block entry
  const renderBlockEntry = (entry: BlockHistoryEntry) => (
    <div
      key={entry.id}
      className="flex items-center justify-between rounded-lg p-3"
      style={{
        backgroundColor: "var(--bsky-bg-secondary)",
        border: "1px solid var(--bsky-border-primary)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            backgroundColor: entry.isActive
              ? "rgba(239, 68, 68, 0.1)"
              : "var(--bsky-bg-tertiary)",
          }}
        >
          {entry.subjectAvatar ? (
            <img
              src={entry.subjectAvatar}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <Ban
              size={20}
              style={{
                color: entry.isActive
                  ? "var(--bsky-error)"
                  : "var(--bsky-text-tertiary)",
              }}
            />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className="font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {entry.subjectDisplayName || entry.subjectHandle || "Unknown"}
            </span>
            {entry.isActive ? (
              <span className="rounded-full bg-red-500 bg-opacity-20 px-2 py-0.5 text-xs text-red-500">
                Active
              </span>
            ) : (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  backgroundColor: "var(--bsky-bg-tertiary)",
                  color: "var(--bsky-text-tertiary)",
                }}
              >
                Unblocked
              </span>
            )}
          </div>
          {entry.subjectHandle && (
            <div
              className="text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              @{entry.subjectHandle}
            </div>
          )}
          <div
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            <Clock size={12} />
            {formatRelativeTime(entry.createdAt)}
            {entry.unblockedAt && (
              <span> · Unblocked {formatRelativeTime(entry.unblockedAt)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render mute entry
  const renderMuteEntry = (entry: MuteHistoryEntry) => (
    <div
      key={entry.id}
      className="flex items-center justify-between rounded-lg p-3"
      style={{
        backgroundColor: "var(--bsky-bg-secondary)",
        border: "1px solid var(--bsky-border-primary)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            backgroundColor: entry.isActive
              ? "rgba(234, 179, 8, 0.1)"
              : "var(--bsky-bg-tertiary)",
          }}
        >
          {entry.subjectAvatar ? (
            <img
              src={entry.subjectAvatar}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <VolumeX
              size={20}
              style={{
                color: entry.isActive
                  ? "var(--bsky-yellow)"
                  : "var(--bsky-text-tertiary)",
              }}
            />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className="font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {entry.subjectDisplayName || entry.subjectHandle || "Unknown"}
            </span>
            {entry.isActive ? (
              <span className="rounded-full bg-yellow-500 bg-opacity-20 px-2 py-0.5 text-xs text-yellow-500">
                Active
              </span>
            ) : (
              <span
                className="rounded-full px-2 py-0.5 text-xs"
                style={{
                  backgroundColor: "var(--bsky-bg-tertiary)",
                  color: "var(--bsky-text-tertiary)",
                }}
              >
                Unmuted
              </span>
            )}
          </div>
          {entry.subjectHandle && (
            <div
              className="text-sm"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              @{entry.subjectHandle}
            </div>
          )}
          <div
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            <Clock size={12} />
            {formatRelativeTime(entry.createdAt)}
            {entry.unmutedAt && (
              <span> · Unmuted {formatRelativeTime(entry.unmutedAt)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // Render report entry
  const renderReportEntry = (entry: ReportHistoryEntry) => {
    const statusColors = {
      pending: { bg: "var(--bsky-warning-10)", text: "var(--bsky-yellow)" },
      resolved: {
        bg: "var(--bsky-success-10)",
        text: "var(--bsky-success-light)",
      },
      unknown: {
        bg: "var(--bsky-bg-tertiary)",
        text: "var(--bsky-text-tertiary)",
      },
    };
    const statusColor = statusColors[entry.status];

    return (
      <div
        key={entry.id}
        className="rounded-lg p-3"
        style={{
          backgroundColor: "var(--bsky-bg-secondary)",
          border: "1px solid var(--bsky-border-primary)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: statusColor.bg }}
          >
            <Flag size={20} style={{ color: statusColor.text }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span
                className="font-medium"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {entry.subjectType === "account"
                  ? entry.subjectDisplayName || entry.subjectHandle || "Account"
                  : entry.subjectType.charAt(0).toUpperCase() +
                    entry.subjectType.slice(1)}
              </span>
              <span
                className="rounded-full px-2 py-0.5 text-xs capitalize"
                style={{
                  backgroundColor: statusColor.bg,
                  color: statusColor.text,
                }}
              >
                {entry.status}
              </span>
            </div>
            {entry.subjectHandle && (
              <div
                className="text-sm"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                @{entry.subjectHandle}
              </div>
            )}
            {entry.subjectText && (
              <div
                className="mt-1 line-clamp-2 text-sm"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                "{entry.subjectText}"
              </div>
            )}
            <div
              className="mt-1 flex items-center gap-2 text-xs"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              <span className="rounded bg-gray-500 bg-opacity-20 px-1.5 py-0.5 capitalize">
                {entry.reason}
              </span>
              <span>·</span>
              <Clock size={12} />
              {formatRelativeTime(entry.createdAt)}
            </div>
            {entry.reasonText && (
              <div
                className="mt-1 text-xs italic"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                Note: {entry.reasonText}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render combined entries
  const renderEntries = () => {
    if (isLoading) {
      return (
        <div
          className="py-8 text-center"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          Loading history...
        </div>
      );
    }

    if (totalItems === 0) {
      return (
        <div
          className="py-8 text-center"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          <AlertTriangle size={48} className="mx-auto mb-2 opacity-50" />
          <p>No moderation history found</p>
          {(searchQuery || startDate || endDate || activeOnly) && (
            <p className="mt-1 text-sm">Try adjusting your filters</p>
          )}
        </div>
      );
    }

    // Combine and sort all entries for "all" tab
    if (activeTab === "all") {
      const allEntries: Array<{
        type: ModerationActionType;
        entry: BlockHistoryEntry | MuteHistoryEntry | ReportHistoryEntry;
        createdAt: number;
      }> = [
        ...sortedData.blocks.map((e) => ({
          type: "block" as const,
          entry: e,
          createdAt: e.createdAt,
        })),
        ...sortedData.mutes.map((e) => ({
          type: "mute" as const,
          entry: e,
          createdAt: e.createdAt,
        })),
        ...sortedData.reports.map((e) => ({
          type: "report" as const,
          entry: e,
          createdAt: e.createdAt,
        })),
      ];

      allEntries.sort((a, b) => {
        if (sortField === "createdAt") {
          return sortDirection === "desc"
            ? b.createdAt - a.createdAt
            : a.createdAt - b.createdAt;
        }
        return 0;
      });

      return (
        <div className="space-y-2">
          {allEntries.map(({ type, entry }) => {
            if (type === "block") {
              return renderBlockEntry(entry as BlockHistoryEntry);
            }
            if (type === "mute") {
              return renderMuteEntry(entry as MuteHistoryEntry);
            }
            return renderReportEntry(entry as ReportHistoryEntry);
          })}
        </div>
      );
    }

    // Render single type
    if (activeTab === "block") {
      return (
        <div className="space-y-2">
          {sortedData.blocks.map(renderBlockEntry)}
        </div>
      );
    }

    if (activeTab === "mute") {
      return (
        <div className="space-y-2">{sortedData.mutes.map(renderMuteEntry)}</div>
      );
    }

    return (
      <div className="space-y-2">
        {sortedData.reports.map(renderReportEntry)}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2
          className="text-xl font-semibold"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          Moderation History
        </h2>
        <p
          className="mt-1 text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          View your block, mute, and report history
        </p>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div
            className="rounded-lg p-3 text-center"
            style={{
              backgroundColor: "var(--bsky-bg-secondary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          >
            <div className="flex items-center justify-center gap-1">
              <Ban size={16} className="text-red-500" />
              <span
                className="text-lg font-semibold"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {stats.activeBlocks}
              </span>
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Active Blocks
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              ({stats.totalBlocks} total)
            </div>
          </div>
          <div
            className="rounded-lg p-3 text-center"
            style={{
              backgroundColor: "var(--bsky-bg-secondary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          >
            <div className="flex items-center justify-center gap-1">
              <VolumeX size={16} className="text-yellow-500" />
              <span
                className="text-lg font-semibold"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {stats.activeMutes}
              </span>
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Active Mutes
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              ({stats.totalMutes} total)
            </div>
          </div>
          <div
            className="rounded-lg p-3 text-center"
            style={{
              backgroundColor: "var(--bsky-bg-secondary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          >
            <div className="flex items-center justify-center gap-1">
              <Flag size={16} className="text-blue-500" />
              <span
                className="text-lg font-semibold"
                style={{ color: "var(--bsky-text-primary)" }}
              >
                {stats.pendingReports}
              </span>
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--bsky-text-secondary)" }}
            >
              Pending Reports
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--bsky-text-tertiary)" }}
            >
              ({stats.totalReports} total)
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex gap-1 rounded-lg p-1"
        style={{ backgroundColor: "var(--bsky-bg-secondary)" }}
      >
        {(["all", "block", "mute", "report"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-blue-500 text-white" : ""
            }`}
            style={
              activeTab !== tab
                ? { color: "var(--bsky-text-secondary)" }
                : undefined
            }
          >
            {tab === "all"
              ? "All"
              : tab.charAt(0).toUpperCase() + tab.slice(1) + "s"}
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--bsky-text-tertiary)" }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by handle or name..."
              className="w-full rounded-lg py-2 pl-9 pr-4 text-sm"
              style={{
                backgroundColor: "var(--bsky-bg-secondary)",
                color: "var(--bsky-text-primary)",
                border: "1px solid var(--bsky-border-primary)",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
              showFilters ? "bg-blue-500 text-white" : ""
            }`}
            style={
              !showFilters
                ? {
                    backgroundColor: "var(--bsky-bg-secondary)",
                    color: "var(--bsky-text-primary)",
                    border: "1px solid var(--bsky-border-primary)",
                  }
                : undefined
            }
          >
            <Filter size={16} />
            Filters
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div
            className="space-y-3 rounded-lg p-4"
            style={{
              backgroundColor: "var(--bsky-bg-secondary)",
              border: "1px solid var(--bsky-border-primary)",
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  <Calendar size={12} className="mr-1 inline" />
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded px-3 py-1.5 text-sm"
                  style={{
                    backgroundColor: "var(--bsky-bg-tertiary)",
                    color: "var(--bsky-text-primary)",
                    border: "1px solid var(--bsky-border-primary)",
                  }}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  <Calendar size={12} className="mr-1 inline" />
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded px-3 py-1.5 text-sm"
                  style={{
                    backgroundColor: "var(--bsky-bg-tertiary)",
                    color: "var(--bsky-text-primary)",
                    border: "1px solid var(--bsky-border-primary)",
                  }}
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="rounded"
                />
                <span
                  className="text-sm"
                  style={{ color: "var(--bsky-text-primary)" }}
                >
                  Active only
                </span>
              </label>
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setActiveOnly(false);
                  setSearchQuery("");
                }}
                className="text-sm text-blue-500 hover:underline"
              >
                Clear filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sort Controls */}
      <div className="flex items-center justify-between">
        <span
          className="text-sm"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          {totalItems} {totalItems === 1 ? "entry" : "entries"}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => toggleSort("createdAt")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              sortField === "createdAt" ? "bg-blue-500 bg-opacity-20" : ""
            }`}
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            Date
            <SortIndicator field="createdAt" />
          </button>
          <button
            onClick={() => toggleSort("handle")}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              sortField === "handle" ? "bg-blue-500 bg-opacity-20" : ""
            }`}
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            Handle
            <SortIndicator field="handle" />
          </button>
        </div>
      </div>

      {/* History List */}
      <div className="max-h-[400px] overflow-y-auto">{renderEntries()}</div>

      {/* Clear History Button */}
      {totalItems > 0 && (
        <div
          className="border-t pt-4"
          style={{ borderColor: "var(--bsky-border-primary)" }}
        >
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-500 hover:bg-opacity-10"
            style={{
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}
          >
            <Trash2 size={16} />
            Clear All History
          </button>
          <p
            className="mt-2 text-xs"
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            This will permanently delete your local moderation history. It will
            not affect your actual blocks, mutes, or reports on Bluesky.
          </p>
        </div>
      )}
    </div>
  );
};
