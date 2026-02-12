import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  Clock,
  Gauge,
  Heart,
  RefreshCw,
  Trash2,
  Wifi,
  XCircle,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import {
  BudgetPreset,
  formatMetricValue,
  getBudgetForPreset,
  getRatingBgColor,
  getRatingColor,
  METRIC_INFO,
} from "../../config/performance-budget";
import { useRealTimeEngagementFlag } from "../../hooks/useRealTimeEngagement";
import {
  type EngagementServiceMetrics,
  getRealTimeEngagementService,
} from "../../services/real-time-engagement-service";
import {
  PerformanceBudget,
  useWebVitals,
  WebVitalsMetrics,
  WebVitalsReport,
} from "../../services/web-vitals-monitor";

interface MetricCardProps {
  metric: keyof typeof METRIC_INFO;
  value: number | null;
  rating: "good" | "needs-improvement" | "poor" | null;
  budget: number;
  exceedsBudget: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  metric,
  value,
  rating,
  budget,
  exceedsBudget,
}) => {
  const info = METRIC_INFO[metric];

  return (
    <div
      className={`rounded-lg border p-4 ${rating ? getRatingBgColor(rating) : "bg-gray-100 dark:bg-gray-800"}`}
      style={{ borderColor: "var(--asph-border-primary)" }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {info.shortName}
        </span>
        {rating && (
          <span className={`text-xs font-medium ${getRatingColor(rating)}`}>
            {rating === "good"
              ? "Good"
              : rating === "needs-improvement"
                ? "Needs Work"
                : "Poor"}
          </span>
        )}
      </div>
      <div className="mb-1 flex items-baseline gap-2">
        <span
          className={`text-2xl font-bold ${rating ? getRatingColor(rating) : "text-gray-400"}`}
        >
          {value !== null ? formatMetricValue(metric, value) : "—"}
        </span>
        {exceedsBudget && (
          <AlertTriangle className="h-4 w-4 text-red-500" aria-hidden="true" />
        )}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Budget: {formatMetricValue(metric, budget)}
      </div>
    </div>
  );
};

interface TrendItemProps {
  metric: string;
  current: number;
  average: number;
  trend: "improving" | "stable" | "degrading";
  percentChange: number;
}

const TrendItem: React.FC<TrendItemProps> = ({
  metric,
  current,
  average: _average,
  trend,
  percentChange,
}) => {
  const TrendIcon =
    trend === "improving"
      ? ArrowDown
      : trend === "degrading"
        ? ArrowUp
        : ArrowRight;
  const trendColor =
    trend === "improving"
      ? "text-green-600 dark:text-green-400"
      : trend === "degrading"
        ? "text-red-600 dark:text-red-400"
        : "text-gray-500 dark:text-gray-400";

  const metricKey = metric.toLowerCase() as keyof typeof METRIC_INFO;
  const unit = METRIC_INFO[metricKey]?.unit || "";

  return (
    <div className="flex items-center justify-between border-b border-gray-200 py-2 last:border-0 dark:border-gray-700">
      <div>
        <span className="font-medium">{metric}</span>
        <span className="ml-2 text-sm text-gray-500">
          {Math.round(current)}
          {unit} avg
        </span>
      </div>
      <div className={`flex items-center gap-1 ${trendColor}`}>
        <TrendIcon className="h-4 w-4" aria-hidden="true" />
        <span className="text-sm font-medium">
          {Math.abs(percentChange).toFixed(1)}%
        </span>
      </div>
    </div>
  );
};

export const PerformanceSettings: React.FC = () => {
  const webVitals = useWebVitals();
  const [report, setReport] = useState<WebVitalsReport | null>(null);
  const [history, setHistory] = useState<WebVitalsMetrics[]>([]);
  const [trends, setTrends] =
    useState<ReturnType<typeof webVitals.getTrendAnalysis>>();
  const [budgetPreset, setBudgetPreset] = useState<BudgetPreset>("production");
  const [customBudget, setCustomBudget] = useState<PerformanceBudget>(
    webVitals.getBudget(),
  );
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Real-time engagement settings
  const { isEnabled: isEngagementEnabled, setEnabled: setEngagementEnabled } =
    useRealTimeEngagementFlag();
  const [engagementMetrics, setEngagementMetrics] =
    useState<EngagementServiceMetrics | null>(null);

  const refreshData = useCallback(() => {
    setReport(webVitals.generateReport());
    setHistory(webVitals.getHistory());
    setTrends(webVitals.getTrendAnalysis());
    setLastUpdate(new Date());
  }, [webVitals]);

  // Initialize monitoring and load data
  useEffect(() => {
    webVitals.init();
    setIsMonitoring(webVitals.isActive());
    refreshData();

    // Subscribe to updates
    const unsubscribe = webVitals.subscribe(() => {
      refreshData();
    });

    return unsubscribe;
  }, [webVitals, refreshData]);

  const handlePresetChange = (preset: BudgetPreset) => {
    setBudgetPreset(preset);
    if (preset !== "custom") {
      const newBudget = getBudgetForPreset(preset);
      setCustomBudget(newBudget);
      webVitals.setBudget(newBudget);
    }
    refreshData();
  };

  const handleCustomBudgetChange = (
    metric: keyof PerformanceBudget,
    value: number,
  ) => {
    const newBudget = { ...customBudget, [metric]: value };
    setCustomBudget(newBudget);
    webVitals.setBudget({ [metric]: value });
    refreshData();
  };

  const handleClearHistory = () => {
    webVitals.clearHistory();
    setHistory([]);
    setTrends([]);
  };

  // Update engagement metrics periodically
  useEffect(() => {
    const updateEngagementMetrics = () => {
      const service = getRealTimeEngagementService();
      setEngagementMetrics(service.getMetrics());
    };

    updateEngagementMetrics();
    const interval = setInterval(updateEngagementMetrics, 2000);
    return () => clearInterval(interval);
  }, [isEngagementEnabled]);

  // Calculate overall score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return CheckCircle2;
    if (score >= 50) return AlertTriangle;
    return XCircle;
  };

  const ScoreIcon = report ? getScoreIcon(report.overallScore) : Activity;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">Performance Monitoring</h1>
        <p className="text-muted-foreground mt-2">
          Track Core Web Vitals and monitor performance regressions in
          real-time.
        </p>
      </div>

      {/* Status Banner */}
      <div
        className="flex items-center justify-between rounded-lg p-4"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        <div className="flex items-center gap-3">
          <Activity
            className={`h-5 w-5 ${isMonitoring ? "text-green-500" : "text-gray-400"}`}
            aria-hidden="true"
          />
          <div>
            <span className="font-medium">
              {isMonitoring
                ? "Monitoring Active"
                : "Monitoring Not Initialized"}
            </span>
            {lastUpdate && (
              <span className="ml-2 text-sm text-gray-500">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={refreshData}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {/* Overall Score */}
      {report && (
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            border: "1px solid var(--asph-border-primary)",
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Performance Score
              </h2>
              <p
                className="text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Based on Core Web Vitals metrics
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ScoreIcon
                className={`h-8 w-8 ${getScoreColor(report.overallScore)}`}
                aria-hidden="true"
              />
              <span
                className={`text-4xl font-bold ${getScoreColor(report.overallScore)}`}
              >
                {report.overallScore}
              </span>
            </div>
          </div>

          {/* Regressions Alert */}
          {report.hasRegressions && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    Performance Budget Exceeded
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {report.regressionDetails.map((detail, idx) => (
                      <li
                        key={`regression-detail-${idx}-${detail.substring(0, 20)}`}
                        className="text-xs text-red-700 dark:text-red-300"
                      >
                        • {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Core Web Vitals Metrics */}
      <div
        className="rounded-lg p-6"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        <div className="mb-4 flex items-center gap-2">
          <Gauge className="h-5 w-5 text-gray-500" aria-hidden="true" />
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Core Web Vitals
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {(["lcp", "fcp", "cls", "ttfb", "inp"] as const).map((metric) => (
            <MetricCard
              key={metric}
              metric={metric}
              value={report?.metrics[metric] ?? null}
              rating={report?.ratings[metric]?.rating ?? null}
              budget={customBudget[metric]}
              exceedsBudget={report?.ratings[metric]?.exceedsBudget ?? false}
            />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          {(["lcp", "fcp", "cls", "ttfb", "inp"] as const).map((metric) => (
            <p
              key={metric}
              className="text-xs"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              <strong>{METRIC_INFO[metric].shortName}:</strong>{" "}
              {METRIC_INFO[metric].description}
            </p>
          ))}
        </div>
      </div>

      {/* Performance Budget Configuration */}
      <div
        className="rounded-lg p-6"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        <div className="mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" aria-hidden="true" />
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Performance Budget
          </h2>
        </div>

        <div className="mb-4">
          <label
            className="mb-2 block text-sm font-medium"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Budget Preset
          </label>
          <div className="flex flex-wrap gap-2">
            {(["strict", "production", "relaxed", "custom"] as const).map(
              (preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetChange(preset)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    budgetPreset === preset
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {preset.charAt(0).toUpperCase() + preset.slice(1)}
                </button>
              ),
            )}
          </div>
        </div>

        {budgetPreset === "custom" && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {(["lcp", "fcp", "cls", "ttfb", "inp"] as const).map((metric) => (
              <div key={metric}>
                <label
                  className="mb-1 block text-xs font-medium"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  {METRIC_INFO[metric].shortName} (
                  {METRIC_INFO[metric].unit || "score"})
                </label>
                <input
                  type="number"
                  value={customBudget[metric]}
                  onChange={(e) =>
                    handleCustomBudgetChange(metric, parseFloat(e.target.value))
                  }
                  step={metric === "cls" ? 0.01 : 100}
                  min={0}
                  className="w-full rounded-md border bg-white px-2 py-1.5 text-sm dark:bg-gray-800"
                  style={{ borderColor: "var(--asph-border-primary)" }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trend Analysis */}
      {trends && trends.length > 0 && (
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: "var(--asph-bg-secondary)",
            border: "1px solid var(--asph-border-primary)",
          }}
        >
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-500" aria-hidden="true" />
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Trend Analysis
            </h2>
          </div>

          <div className="space-y-1">
            {trends.map((trend) => (
              <TrendItem key={trend.metric} {...trend} />
            ))}
          </div>
        </div>
      )}

      {/* Historical Data */}
      <div
        className="rounded-lg p-6"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-500" aria-hidden="true" />
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Historical Data
            </h2>
            <span
              className="text-sm"
              style={{ color: "var(--asph-text-secondary)" }}
            >
              ({history.length} sessions)
            </span>
          </div>
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p
            className="text-center text-sm"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            No historical data yet. Continue using the app to collect
            performance metrics.
          </p>
        ) : (
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b"
                  style={{ borderColor: "var(--asph-border-primary)" }}
                >
                  <th
                    className="py-2 text-left font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    Date
                  </th>
                  <th
                    className="py-2 text-right font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    LCP
                  </th>
                  <th
                    className="py-2 text-right font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    FCP
                  </th>
                  <th
                    className="py-2 text-right font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    CLS
                  </th>
                  <th
                    className="py-2 text-right font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    TTFB
                  </th>
                  <th
                    className="py-2 text-right font-medium"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    INP
                  </th>
                </tr>
              </thead>
              <tbody>
                {history
                  .slice()
                  .reverse()
                  .slice(0, 20)
                  .map((entry, idx) => (
                    <tr
                      key={`perf-entry-${entry.timestamp}-${idx}`}
                      className="border-b last:border-0"
                      style={{ borderColor: "var(--asph-border-primary)" }}
                    >
                      <td
                        className="py-1.5"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {new Date(entry.timestamp).toLocaleDateString()}{" "}
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </td>
                      <td
                        className="py-1.5 text-right"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {entry.lcp !== null
                          ? formatMetricValue("lcp", entry.lcp)
                          : "—"}
                      </td>
                      <td
                        className="py-1.5 text-right"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {entry.fcp !== null
                          ? formatMetricValue("fcp", entry.fcp)
                          : "—"}
                      </td>
                      <td
                        className="py-1.5 text-right"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {entry.cls !== null
                          ? formatMetricValue("cls", entry.cls)
                          : "—"}
                      </td>
                      <td
                        className="py-1.5 text-right"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {entry.ttfb !== null
                          ? formatMetricValue("ttfb", entry.ttfb)
                          : "—"}
                      </td>
                      <td
                        className="py-1.5 text-right"
                        style={{ color: "var(--asph-text-primary)" }}
                      >
                        {entry.inp !== null
                          ? formatMetricValue("inp", entry.inp)
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Real-Time Engagement Section */}
      <div
        className="rounded-lg p-6"
        style={{
          backgroundColor: "var(--asph-bg-secondary)",
          border: "1px solid var(--asph-border-primary)",
        }}
      >
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" aria-hidden="true" />
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Real-Time Engagement
          </h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Beta
          </span>
        </div>

        <p
          className="mb-4 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Receive live updates for like, repost, and reply counts on posts
          visible in your feed. Requires an active WebSocket connection.
        </p>

        {/* Toggle Switch */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <span
              className="font-medium"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Enable Real-Time Engagement
            </span>
            <p
              className="text-sm"
              style={{ color: "var(--asph-text-tertiary)" }}
            >
              Updates engagement counts automatically as they change
            </p>
          </div>
          <button
            onClick={() => setEngagementEnabled(!isEngagementEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              isEngagementEnabled
                ? "bg-blue-600"
                : "bg-gray-300 dark:bg-gray-600"
            }`}
            role="switch"
            aria-checked={isEngagementEnabled}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                isEngagementEnabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Engagement Metrics */}
        {isEngagementEnabled && engagementMetrics && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div
              className="rounded-lg p-3"
              style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
            >
              <div className="flex items-center gap-2">
                <Wifi
                  className={`h-4 w-4 ${engagementMetrics.isActive ? "text-green-500" : "text-gray-400"}`}
                />
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  Status
                </span>
              </div>
              <p
                className="mt-1 text-sm font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                {engagementMetrics.isActive ? "Active" : "Inactive"}
              </p>
            </div>

            <div
              className="rounded-lg p-3"
              style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
            >
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  Subscriptions
                </span>
              </div>
              <p
                className="mt-1 text-sm font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                {engagementMetrics.activeSubscriptions} posts
              </p>
            </div>

            <div
              className="rounded-lg p-3"
              style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
            >
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  Updates Received
                </span>
              </div>
              <p
                className="mt-1 text-sm font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                {engagementMetrics.updatesReceived}
              </p>
            </div>

            <div
              className="rounded-lg p-3"
              style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-500" />
                <span
                  className="text-xs font-medium"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  Viewport Update
                </span>
              </div>
              <p
                className="mt-1 text-sm font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                {Math.round(engagementMetrics.avgViewportUpdateIntervalMs)}ms
              </p>
            </div>
          </div>
        )}

        {/* Performance Note */}
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Performance Considerations
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Real-time engagement uses WebSocket connections and viewport
                tracking. Updates are throttled and batched to minimize CPU
                usage. Disable if you notice performance issues on older
                devices.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div
        className="rounded-lg p-4 text-sm"
        style={{
          backgroundColor: "var(--asph-bg-tertiary)",
          border: "1px solid var(--asph-border-primary)",
          color: "var(--asph-text-secondary)",
        }}
      >
        <p className="mb-1 font-medium">About Web Vitals:</p>
        <ul className="ml-4 space-y-1">
          <li>
            • <strong>LCP:</strong> Measures loading performance - target under
            2.5 seconds
          </li>
          <li>
            • <strong>FCP:</strong> Measures perceived speed - target under 1.8
            seconds
          </li>
          <li>
            • <strong>CLS:</strong> Measures visual stability - target under 0.1
          </li>
          <li>
            • <strong>TTFB:</strong> Measures server response - target under
            800ms
          </li>
          <li>
            • <strong>INP:</strong> Measures interactivity - target under 200ms
          </li>
        </ul>
        <p className="mt-2 text-xs text-gray-500">
          Metrics are collected as you use the app and stored locally. Enable
          debug mode (<code>window.enableDebug()</code>) to see detailed logs.
        </p>
      </div>
    </div>
  );
};
