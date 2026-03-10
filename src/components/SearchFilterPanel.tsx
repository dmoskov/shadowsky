import { format, subMonths, subWeeks } from "date-fns";
import {
  Calendar,
  FileText,
  Globe,
  Heart,
  Image,
  Link,
  MessageCircle,
  Repeat2,
  User,
  Video,
  X,
} from "lucide-react";
import React, { useCallback, useMemo } from "react";
import {
  defaultFilters,
  type DatePreset,
  type MediaType,
  type SearchFilters,
} from "../hooks/useSearch";
import { UserTypeahead } from "./UserTypeahead";

interface SearchFilterPanelProps {
  filters: SearchFilters;
  setFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  onClose?: () => void;
}

// Active filter chip component
const FilterChip: React.FC<{
  label: string;
  onRemove: () => void;
}> = ({ label, onRemove }) => (
  <span
    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-2 text-xs"
    style={{
      backgroundColor: "var(--asph-primary)",
      color: "white",
    }}
  >
    {label}
    <button
      onClick={onRemove}
      className="touch-target flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      aria-label={`Remove ${label} filter`}
    >
      <X size={12} />
    </button>
  </span>
);

// Engagement slider component
const EngagementSlider: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
  icon: React.ReactNode;
  max?: number;
}> = ({ label, value, onChange, icon, max = 100 }) => {
  // Calculate logarithmic slider values for better UX
  const sliderToValue = (sliderValue: number): number => {
    if (sliderValue === 0) return 0;
    // Use exponential scale: 0 -> 0, 100 -> max
    return Math.round(Math.pow(sliderValue / 100, 2) * max);
  };

  const valueToSlider = (actualValue: number): number => {
    if (actualValue === 0) return 0;
    return Math.round(Math.sqrt(actualValue / max) * 100);
  };

  const displayValue =
    value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label
          className="flex items-center gap-1.5 text-xs font-medium"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          {icon}
          {label}
        </label>
        <span
          className="min-w-[32px] text-right text-xs font-medium"
          style={{
            color:
              value > 0 ? "var(--asph-primary)" : "var(--asph-text-tertiary)",
          }}
        >
          {value > 0 ? `${displayValue}+` : "Any"}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={valueToSlider(value)}
        onChange={(e) => onChange(sliderToValue(parseInt(e.target.value, 10)))}
        className="asph-slider w-full"
        style={
          {
            "--slider-progress": `${valueToSlider(value)}%`,
          } as React.CSSProperties
        }
      />
    </div>
  );
};

export const SearchFilterPanel: React.FC<SearchFilterPanelProps> = ({
  filters,
  setFilters,
}) => {
  // Helper to update a single filter field
  const updateFilter = useCallback(
    <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [setFilters],
  );

  // Helper to update engagement thresholds
  const updateEngagement = useCallback(
    (field: keyof typeof filters.engagement, value: number) => {
      setFilters((prev) => ({
        ...prev,
        engagement: { ...prev.engagement, [field]: value },
      }));
    },
    [setFilters],
  );

  // Set date range from preset
  const setDateFromPreset = useCallback(
    (preset: DatePreset) => {
      const today = new Date();
      let sinceDate = "";
      let untilDate = format(today, "yyyy-MM-dd");

      switch (preset) {
        case "today":
          sinceDate = format(today, "yyyy-MM-dd");
          break;
        case "week":
          sinceDate = format(subWeeks(today, 1), "yyyy-MM-dd");
          break;
        case "month":
          sinceDate = format(subMonths(today, 1), "yyyy-MM-dd");
          break;
        case "year":
          sinceDate = format(subMonths(today, 12), "yyyy-MM-dd");
          break;
        case "custom":
          // Keep existing dates for custom
          return setFilters((prev) => ({ ...prev, datePreset: "custom" }));
        case null:
          sinceDate = "";
          untilDate = "";
          break;
      }

      setFilters((prev) => ({
        ...prev,
        datePreset: preset,
        sinceDate,
        untilDate,
      }));
    },
    [setFilters],
  );

  // Check if there are any active filters
  const hasActiveFilters = useMemo(() => {
    return (
      filters.mediaType !== "all" ||
      filters.hasMedia ||
      filters.fromUsers.length > 0 ||
      filters.sinceDate ||
      filters.untilDate ||
      filters.language ||
      filters.engagement.minLikes > 0 ||
      filters.engagement.minReposts > 0 ||
      filters.engagement.minReplies > 0
    );
  }, [filters]);

  // Get active filter chips
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> =
      [];

    if (filters.mediaType !== "all") {
      chips.push({
        key: "mediaType",
        label:
          filters.mediaType === "text-only" ? "Text only" : filters.mediaType,
        onRemove: () => updateFilter("mediaType", "all"),
      });
    }

    filters.fromUsers.forEach((user, index) => {
      chips.push({
        key: `user-${index}`,
        label: `@${user}`,
        onRemove: () =>
          updateFilter(
            "fromUsers",
            filters.fromUsers.filter((_, i) => i !== index),
          ),
      });
    });

    if (filters.datePreset && filters.datePreset !== "custom") {
      const presetLabels: Record<string, string> = {
        today: "Today",
        week: "Past week",
        month: "Past month",
        year: "Past year",
      };
      chips.push({
        key: "datePreset",
        label: presetLabels[filters.datePreset] || filters.datePreset,
        onRemove: () => setDateFromPreset(null),
      });
    } else if (filters.sinceDate || filters.untilDate) {
      chips.push({
        key: "dateRange",
        label: `${filters.sinceDate || "Start"} - ${filters.untilDate || "Now"}`,
        onRemove: () => {
          setFilters((prev) => ({
            ...prev,
            sinceDate: "",
            untilDate: "",
            datePreset: null,
          }));
        },
      });
    }

    if (filters.language) {
      const langNames: Record<string, string> = {
        en: "English",
        ja: "Japanese",
        es: "Spanish",
        fr: "French",
        de: "German",
        pt: "Portuguese",
        ko: "Korean",
        zh: "Chinese",
      };
      chips.push({
        key: "language",
        label: langNames[filters.language] || filters.language,
        onRemove: () => updateFilter("language", ""),
      });
    }

    if (filters.engagement.minLikes > 0) {
      chips.push({
        key: "likes",
        label: `${filters.engagement.minLikes}+ likes`,
        onRemove: () => updateEngagement("minLikes", 0),
      });
    }

    if (filters.engagement.minReposts > 0) {
      chips.push({
        key: "reposts",
        label: `${filters.engagement.minReposts}+ reposts`,
        onRemove: () => updateEngagement("minReposts", 0),
      });
    }

    if (filters.engagement.minReplies > 0) {
      chips.push({
        key: "replies",
        label: `${filters.engagement.minReplies}+ replies`,
        onRemove: () => updateEngagement("minReplies", 0),
      });
    }

    return chips;
  }, [filters, updateFilter, updateEngagement, setDateFromPreset, setFilters]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, [setFilters]);

  const mediaTypes: Array<{
    value: MediaType;
    label: string;
    icon: React.ReactNode;
  }> = [
    { value: "all", label: "All", icon: null },
    { value: "images", label: "Images", icon: <Image size={12} /> },
    { value: "videos", label: "Videos", icon: <Video size={12} /> },
    { value: "links", label: "Links", icon: <Link size={12} /> },
    { value: "text-only", label: "Text", icon: <FileText size={12} /> },
  ];

  const datePresets: Array<{ value: DatePreset; label: string }> = [
    { value: "today", label: "Today" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
    { value: "year", label: "Year" },
    { value: "custom", label: "Custom" },
  ];

  return (
    <div
      className="border-t px-4 py-3"
      style={{ borderColor: "var(--asph-border-primary)" }}
    >
      <div className="space-y-4">
        {/* Active Filter Chips */}
        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-xs font-medium"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              Active:
            </span>
            {activeFilterChips.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                onRemove={chip.onRemove}
              />
            ))}
            <button
              onClick={resetFilters}
              className="touch-target-sm min-h-[44px] px-2 text-xs transition-colors hover:underline"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Media Type Filter */}
        <div>
          <label
            className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            <Image size={12} />
            Media Type
          </label>
          <div className="flex flex-wrap gap-2">
            {mediaTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => updateFilter("mediaType", type.value)}
                className={`touch-target flex min-h-[44px] items-center gap-1.5 rounded-md px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                  filters.mediaType === type.value ? "ring-1" : ""
                }`}
                style={{
                  backgroundColor:
                    filters.mediaType === type.value
                      ? "var(--asph-primary)"
                      : "var(--asph-bg-secondary)",
                  color:
                    filters.mediaType === type.value
                      ? "white"
                      : "var(--asph-text-secondary)",
                  borderWidth: "1px",
                  borderColor:
                    filters.mediaType === type.value
                      ? "var(--asph-primary)"
                      : "var(--asph-border-primary)",
                  // @ts-expect-error CSS custom property for focus ring
                  "--tw-ring-color": "var(--asph-primary)",
                }}
              >
                {type.icon}
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Filter */}
        <div>
          <label
            className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            <Calendar size={12} />
            Date Range
          </label>
          <div className="flex flex-wrap gap-2">
            {datePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => setDateFromPreset(preset.value)}
                className={`touch-target min-h-[44px] rounded-md px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ${
                  filters.datePreset === preset.value ? "ring-1" : ""
                }`}
                style={{
                  backgroundColor:
                    filters.datePreset === preset.value
                      ? "var(--asph-primary)"
                      : "var(--asph-bg-secondary)",
                  color:
                    filters.datePreset === preset.value
                      ? "white"
                      : "var(--asph-text-secondary)",
                  borderWidth: "1px",
                  borderColor:
                    filters.datePreset === preset.value
                      ? "var(--asph-primary)"
                      : "var(--asph-border-primary)",
                  // @ts-expect-error CSS custom property for focus ring
                  "--tw-ring-color": "var(--asph-primary)",
                }}
              >
                {preset.label}
              </button>
            ))}
            {(filters.sinceDate || filters.untilDate) && (
              <button
                onClick={() => setDateFromPreset(null)}
                className="touch-target-sm min-h-[44px] rounded-md px-3 py-2 text-xs transition-colors hover:bg-gray-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:hover:bg-gray-700/50"
                style={{
                  color: "var(--asph-text-tertiary)",
                  // @ts-expect-error CSS custom property for focus ring
                  "--tw-ring-color": "var(--asph-primary)",
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Custom Date Inputs */}
          {filters.datePreset === "custom" && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="date"
                value={filters.sinceDate}
                max={filters.untilDate || undefined}
                onChange={(e) => updateFilter("sinceDate", e.target.value)}
                className="rounded-md border px-2 py-1 text-xs"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  borderColor: "var(--asph-border-primary)",
                  color: "var(--asph-text-primary)",
                  colorScheme: "dark",
                }}
              />
              <span
                className="text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                to
              </span>
              <input
                type="date"
                value={filters.untilDate}
                min={filters.sinceDate || undefined}
                onChange={(e) => updateFilter("untilDate", e.target.value)}
                className="rounded-md border px-2 py-1 text-xs"
                style={{
                  backgroundColor: "var(--asph-bg-secondary)",
                  borderColor: "var(--asph-border-primary)",
                  color: "var(--asph-text-primary)",
                  colorScheme: "dark",
                }}
              />
            </div>
          )}
        </div>

        {/* Engagement Thresholds */}
        <div>
          <label
            className="mb-2 flex items-center gap-1.5 text-xs font-medium"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            <Heart size={12} />
            Engagement Thresholds
          </label>
          <div className="space-y-3">
            <EngagementSlider
              label="Min Likes"
              value={filters.engagement.minLikes}
              onChange={(value) => updateEngagement("minLikes", value)}
              icon={<Heart size={12} />}
              max={1000}
            />
            <EngagementSlider
              label="Min Reposts"
              value={filters.engagement.minReposts}
              onChange={(value) => updateEngagement("minReposts", value)}
              icon={<Repeat2 size={12} />}
              max={500}
            />
            <EngagementSlider
              label="Min Replies"
              value={filters.engagement.minReplies}
              onChange={(value) => updateEngagement("minReplies", value)}
              icon={<MessageCircle size={12} />}
              max={200}
            />
          </div>
        </div>

        {/* From User Filter */}
        <div>
          <label
            className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            <User size={12} />
            From Users
          </label>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {filters.fromUsers.map((user, i) => (
                <div
                  key={`from-user-${user}-${i}`}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 py-2 text-xs"
                  style={{
                    backgroundColor: "var(--asph-bg-secondary)",
                    borderColor: "var(--asph-border-primary)",
                    color: "var(--asph-text-primary)",
                  }}
                >
                  <span>@{user}</span>
                  <button
                    onClick={() =>
                      updateFilter(
                        "fromUsers",
                        filters.fromUsers.filter((_, idx) => idx !== i),
                      )
                    }
                    className="touch-target ml-1 flex h-6 w-6 items-center justify-center rounded hover:bg-gray-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:hover:bg-gray-700/60"
                    aria-label={`Remove @${user}`}
                    style={{
                      // @ts-expect-error CSS custom property for focus ring
                      "--tw-ring-color": "var(--asph-primary)",
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <UserTypeahead
              onSelectUser={(handle) => {
                updateFilter("fromUsers", [...filters.fromUsers, handle]);
              }}
              placeholder="Search users..."
            />
          </div>
        </div>

        {/* Language Filter */}
        <div>
          <label
            className="mb-1.5 flex items-center gap-1.5 text-xs font-medium"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            <Globe size={12} />
            Language
          </label>
          <select
            value={filters.language}
            onChange={(e) => updateFilter("language", e.target.value)}
            className="min-h-[44px] rounded-md border px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              backgroundColor: "var(--asph-bg-secondary)",
              borderColor: "var(--asph-border-primary)",
              color: "var(--asph-text-primary)",
              // @ts-expect-error CSS custom property for focus ring
              "--tw-ring-color": "var(--asph-primary)",
            }}
          >
            <option value="">Any language</option>
            <option value="en">English</option>
            <option value="ja">Japanese</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="pt">Portuguese</option>
            <option value="ko">Korean</option>
            <option value="zh">Chinese</option>
          </select>
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="touch-target-sm min-h-[44px] w-full rounded-md py-2 text-xs transition-colors hover:bg-gray-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:hover:bg-gray-700/50"
            style={{
              color: "var(--asph-text-tertiary)",
              borderWidth: "1px",
              borderColor: "var(--asph-border-primary)",
              // @ts-expect-error CSS custom property for focus ring
              "--tw-ring-color": "var(--asph-primary)",
            }}
          >
            Reset all filters
          </button>
        )}
      </div>
    </div>
  );
};
