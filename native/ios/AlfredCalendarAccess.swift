import EventKit
import Foundation

/// Native iOS calendar access for the Alfred app shell.
/// Requires NSCalendarsFullAccessUsageDescription in Info.plist and iOS 17+.
@MainActor
final class AlfredCalendarAccess {
    private let store = EKEventStore()

    struct CalendarInfo: Codable {
        let id: String
        let title: String
        let source: String
    }

    func calendars() throws -> [CalendarInfo] {
        let status = EKEventStore.authorizationStatus(for: .event)
        guard status == .fullAccess else { throw CalendarAccessError.permissionDenied }
        return store.calendars(for: .event).map { calendar in
            CalendarInfo(id: calendar.calendarIdentifier, title: calendar.title, source: calendar.source.title)
        }.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }

    struct CalendarEvent: Codable {
        let id: String
        let externalId: String?
        let occurrenceDate: String?
        let title: String
        let startsAt: String
        let endsAt: String
        let isAllDay: Bool
        let isRecurring: Bool
        let calendarTitle: String
        let calendarId: String
        let location: String?
    }

    struct CalendarSnapshot {
        let events: [CalendarEvent]
        let rangeStart: String
        let rangeEnd: String
        let calendarIds: [String]
    }

    enum CalendarAccessError: Error {
        case permissionDenied
        case invalidDateRange
        case invalidCalendarSelection
        case incompleteSnapshot
    }

    func requestPermission() async throws {
        let granted = try await store.requestFullAccessToEvents()
        guard granted else { throw CalendarAccessError.permissionDenied }
    }

    /// Returns events in the device's local calendar range.
    /// Events without a stable EventKit identifier are omitted to avoid duplicate imports.
    func snapshot(from start: Date = .now, daysAhead: Int = 90, calendarIds: [String]) throws -> CalendarSnapshot {
        guard (1...365).contains(daysAhead) else {
            throw CalendarAccessError.invalidDateRange
        }

        let status = EKEventStore.authorizationStatus(for: .event)
        guard status == .fullAccess else {
            throw CalendarAccessError.permissionDenied
        }

        let end = Calendar.current.date(byAdding: .day, value: daysAhead, to: start) ?? start
        let requestedIds = Set(calendarIds)
        guard !requestedIds.isEmpty, requestedIds.count == calendarIds.count else {
            throw CalendarAccessError.invalidCalendarSelection
        }
        let availableCalendars = store.calendars(for: .event)
        let selectedCalendars = availableCalendars.filter { requestedIds.contains($0.calendarIdentifier) }
        // Never return a misleading partial/empty snapshot: the caller may use it
        // to reconcile and archive events that appear to have disappeared.
        guard selectedCalendars.count == requestedIds.count else {
            throw CalendarAccessError.invalidCalendarSelection
        }
        let predicate = store.predicateForEvents(withStart: start, end: end, calendars: selectedCalendars)

        let matchingEvents = store.events(matching: predicate)
            .sorted { $0.startDate < $1.startDate }
        // If even one result has no stable identifier, do not claim a complete
        // snapshot: omitting it could make an existing imported event look deleted.
        guard matchingEvents.allSatisfy({ $0.eventIdentifier != nil }) else {
            throw CalendarAccessError.incompleteSnapshot
        }
        let events = matchingEvents.map { event in
                // calendarItemIdentifier may identify the recurring series rather than
                // this specific occurrence. Using it as a fallback would collapse
                // multiple occurrences into one imported appointment.
                let stableId = event.eventIdentifier!
                return CalendarEvent(
                    id: stableId,
                    externalId: event.calendarItemExternalIdentifier,
                    occurrenceDate: event.occurrenceDate.map { ISO8601DateFormatter().string(from: $0) },
                    title: event.title ?? "Sem título",
                    startsAt: ISO8601DateFormatter().string(from: event.startDate),
                    endsAt: ISO8601DateFormatter().string(from: event.endDate),
                    isAllDay: event.isAllDay,
                    isRecurring: event.hasRecurrenceRules,
                    calendarTitle: event.calendar.title,
                    calendarId: event.calendar.calendarIdentifier,
                    location: event.location
                )
            }

        let formatter = ISO8601DateFormatter()
        return CalendarSnapshot(
            events: events,
            rangeStart: formatter.string(from: start),
            rangeEnd: formatter.string(from: end),
            calendarIds: selectedCalendars.map(\.calendarIdentifier)
        )
    }
}
