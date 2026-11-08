import SwiftUI

@main
struct AlfredApp: App {
    var body: some Scene {
        WindowGroup {
            AlfredWebView()
                .ignoresSafeArea(edges: .bottom)
        }
    }
}
