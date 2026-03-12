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
            Prop("timeRange") { (view: NativeAnalyticsExpoView, range: String) in
                view.timeRange = range
            }
            Prop("isLoading") { (view: NativeAnalyticsExpoView, loading: Bool) in
                view.isLoading = loading
            }
            Prop("isRefreshing") { (view: NativeAnalyticsExpoView, refreshing: Bool) in
                view.isRefreshing = refreshing
            }

            Events("onTimeRangeChange", "onPostPress", "onRefresh", "onScroll")
        }
    }
}
