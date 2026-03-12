import ExpoModulesCore
import SwiftUI

class NativeAnalyticsExpoView: ExpoView {
    private let onTimeRangeChange = EventDispatcher()
    private let onPostPress = EventDispatcher()
    private let onRefresh = EventDispatcher()
    private let onScroll = EventDispatcher()

    private var hostController: UIHostingController<AnalyticsView>?
    private let viewModel = AnalyticsViewModel()

    var isLoading: Bool = false { didSet { viewModel.isLoading = isLoading } }
    var isRefreshing: Bool = false { didSet { viewModel.isRefreshing = isRefreshing } }
    var timeRange: String = "7d" { didSet { viewModel.timeRange = timeRange } }

    func updateMetrics(json: String) {
        viewModel.parseMetrics(json: json)
    }

    func updateTopPosts(json: String) {
        viewModel.parseTopPosts(json: json)
    }

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)

        let view = AnalyticsView(
            viewModel: viewModel,
            onTimeRangeChange: { [weak self] range in
                self?.onTimeRangeChange(["range": range])
            },
            onPostPress: { [weak self] uri, handle, did in
                self?.onPostPress(["uri": uri, "handle": handle, "did": did])
            },
            onRefresh: { [weak self] in
                self?.onRefresh([:])
            },
            onScroll: { [weak self] offset in
                self?.onScroll(["y": offset])
            }
        )

        let host = UIHostingController(rootView: view)
        host.view.backgroundColor = .clear
        hostController = host
        addSubview(host.view)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        hostController?.view.frame = bounds
    }

    required init?(coder: NSCoder) { fatalError() }
}
