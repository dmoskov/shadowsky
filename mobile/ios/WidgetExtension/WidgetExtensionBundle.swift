import WidgetKit
import SwiftUI

@main
struct WidgetExtensionBundle: WidgetBundle {
    var body: some Widget {
        NotificationCountWidget()
        TrendingTopicsWidget()
        RecentDMsWidget()
    }
}
