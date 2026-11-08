import SwiftUI
import UIKit
import WebKit
import EventKit

/// SwiftUI container that opens the hosted Alfred interface and exposes
/// a narrowly-scoped, read-only Apple Calendar bridge.
struct AlfredWebView: UIViewRepresentable {
    private let alfredURL = URL(string: "https://bm000001.github.io/Alfred/")!

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "alfredCalendar")

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.load(URLRequest(url: alfredURL))
        context.coordinator.webView = webView
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "alfredCalendar")
        webView.navigationDelegate = nil
        coordinator.webView = nil
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        weak var webView: WKWebView?
        private let calendarAccess = AlfredCalendarAccess()

        override init() {
            super.init()
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(calendarStoreDidChange),
                name: .EKEventStoreChanged,
                object: nil
            )
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(applicationDidBecomeActive),
                name: UIApplication.didBecomeActiveNotification,
                object: nil
            )
        }

        deinit {
            NotificationCenter.default.removeObserver(self)
        }

        @objc private func calendarStoreDidChange() {
            notifyWebAppOfCalendarChange()
        }

        @objc private func applicationDidBecomeActive() {
            notifyWebAppOfCalendarChange()
        }

        private func notifyWebAppOfCalendarChange() {
            guard let webView, isTrustedAlfredURL(webView.url) else { return }
            webView.evaluateJavaScript(
                "window.dispatchEvent(new Event('alfred-native-calendar-changed'));"
            )
        }

        private func isTrustedAlfredURL(_ url: URL?) -> Bool {
            guard let url, url.scheme == "https", url.host == "bm000001.github.io" else {
                return false
            }
            let path = url.path
            return path == "/Alfred" || path.hasPrefix("/Alfred/")
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard isTrustedAlfredURL(webView.url) else { return }
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(isTrustedAlfredURL(navigationAction.request.url) ? .allow : .cancel)
        }

        func userContentController(_ userContentController: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard message.name == "alfredCalendar",
                  message.frameInfo.isMainFrame,
                  message.frameInfo.securityOrigin.protocol == "https",
                  message.frameInfo.securityOrigin.host == "bm000001.github.io",
                  isTrustedAlfredURL(message.frameInfo.request.url),
                  let body = message.body as? [String: Any],
                  let action = body["action"] as? String,
                  let requestId = body["requestId"] as? String,
                  !requestId.isEmpty,
                  requestId.count <= 100 else { return }

            let calendarIds = body["calendarIds"] as? [String]
            Task {
                do {
                    switch action {
                    case "connect":
                        try await calendarAccess.requestPermission()
                        let calendars = try calendarAccess.calendars()
                        send(["requestId": requestId, "status": "connected",
                              "calendars": calendars.map { ["id": $0.id, "title": $0.title, "source": $0.source] }])
                    case "sync":
                        guard let calendarIds, !calendarIds.isEmpty,
                              Set(calendarIds).count == calendarIds.count else {
                            send(["requestId": requestId, "status": "error",
                                  "message": "Selecione ao menos um calendário válido antes de sincronizar."])
                            return
                        }
                        let snapshot = try calendarAccess.snapshot(calendarIds: calendarIds)
                        send(["requestId": requestId, "status": "success",
                              "snapshotComplete": true,
                              "rangeStart": snapshot.rangeStart,
                              "rangeEnd": snapshot.rangeEnd,
                              "calendarIds": snapshot.calendarIds,
                              "events": snapshot.events.map(Self.serialize)])
                    default:
                        send(["requestId": requestId, "status": "error",
                              "message": "Ação de calendário desconhecida."])
                    }
                } catch let error as AlfredCalendarAccess.CalendarAccessError {
                    let message: String
                    switch error {
                    case .incompleteSnapshot:
                        message = "O iPhone retornou um evento sem identificador estável. A sincronização foi interrompida para proteger os compromissos existentes."
                    case .invalidCalendarSelection:
                        message = "Um ou mais calendários selecionados não estão mais disponíveis. Atualize a lista antes de sincronizar."
                    case .invalidDateRange:
                        message = "O intervalo solicitado para leitura do calendário é inválido."
                    case .permissionDenied:
                        message = "O Alfred não tem permissão de acesso completo ao Calendário Apple."
                    }
                    send(["requestId": requestId, "status": "error", "message": message])
                } catch {
                    send(["requestId": requestId, "status": "error",
                          "message": "Não foi possível acessar o Calendário Apple. Verifique a permissão do Alfred."])
                }
            }
        }

        private static func serialize(_ event: AlfredCalendarAccess.CalendarEvent) -> [String: Any] {
            [
                "id": event.id,
                "externalId": event.externalId as Any? ?? NSNull(),
                "occurrenceDate": event.occurrenceDate as Any? ?? NSNull(),
                "title": event.title,
                "startsAt": event.startsAt,
                "endsAt": event.endsAt,
                "isAllDay": event.isAllDay,
                "isRecurring": event.isRecurring,
                "calendarTitle": event.calendarTitle,
                "calendarId": event.calendarId,
                "location": event.location as Any? ?? NSNull()
            ]
        }

        private func send(_ payload: [String: Any]) {
            guard let data = try? JSONSerialization.data(withJSONObject: payload, options: [.fragmentsAllowed]),
                  let json = String(data: data, encoding: .utf8) else { return }
            webView?.evaluateJavaScript(
                "window.dispatchEvent(new CustomEvent('alfred-native-calendar', { detail: \(json) }));"
            )
        }
    }
}
