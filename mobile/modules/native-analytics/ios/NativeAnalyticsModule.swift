import ExpoModulesCore

public class NativeAnalyticsModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeAnalytics")

        View(NativeAnalyticsExpoView.self) {
            Prop("metricsJSON") { (view: NativeAnalyticsExpoView, json: String) in
                view.updateMetrics(json: json)
            }
            Prop("topPostsJSON") { (view: NativeAnalyticsExpoView, json: String) in
                view.updateTopPosts(json: json)
            }
            Prop("analysisJSON") { (view: NativeAnalyticsExpoView, json: String) in
                view.updateAnalysis(json: json)
            }
            Prop("timeRange") { (view: NativeAnalyticsExpoView, range: String) in
                view.timeRange = range
            }
            Prop("isLoading") { (view: NativeAnalyticsExpoView, loading: Bool) in
                view.isLoading = loading
            }
            Prop("isRefreshing") { (view: NativeAnalyticsExpoView, refreshing: Bool) in
                view.isRefreshing = refreshing
            }
            Prop("isLoadingAnalysis") { (view: NativeAnalyticsExpoView, loading: Bool) in
                view.isLoadingAnalysis = loading
            }
            Prop("analysisRequested") { (view: NativeAnalyticsExpoView, requested: Bool) in
                view.analysisRequested = requested
            }

            Events("onTimeRangeChange", "onPostPress", "onRefresh", "onScroll", "onAnalyzeRequest")
        }
    }
}
