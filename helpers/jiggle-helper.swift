import CoreGraphics
import Foundation
import IOKit
import IOKit.pwr_mgt

let args = CommandLine.arguments

guard args.count > 1 else {
    fputs("Usage: jiggle-helper [mouse|zen|idle-time|mouse-drift|scroll|key-safe|check-access]\n", stderr)
    exit(1)
}

// Exit codes: 1 = error, 2 = Accessibility denied.
let EXIT_NO_ACCESS: Int32 = 2

// CGEventPost fails silently when Accessibility is denied — it returns void and
// the process still exits 0. Preflight explicitly so the caller can tell
// "worked" from "was ignored". This must run in the HELPER's code identity: the
// Electron main process is signed separately and may be trusted when we are not.
func requirePostAccess() {
    guard CGPreflightPostEventAccess() else {
        fputs("Accessibility permission denied\n", stderr)
        exit(EXIT_NO_ACCESS)
    }
}

// CGWarpMouseCursorPosition moves the cursor but posts no event, so it does NOT
// reset the system idle timer — Slack/Teams still go "away". Only a real HID
// event does, which is why every cursor action below is posted rather than
// warped.
func postMouseMoved(to point: CGPoint) {
    let source = CGEventSource(stateID: .hidSystemState)
    guard let event = CGEvent(mouseEventSource: source, mouseType: .mouseMoved,
                              mouseCursorPosition: point, mouseButton: .left) else {
        fputs("failed to create mouse event\n", stderr)
        exit(1)
    }
    event.post(tap: .cghidEventTap)
}

switch args[1] {
case "check-access":
    // Reports this binary's own ability to post events. Never prompts.
    print(CGPreflightPostEventAccess() ? "granted" : "denied")

case "mouse":
    requirePostAccess()
    guard let ref = CGEvent(source: nil) else { exit(1) }
    let loc = ref.location
    postMouseMoved(to: CGPoint(x: loc.x + 2, y: loc.y + 2))
    // 120ms pause — enough for the display to render the nudge visibly
    usleep(120_000)
    // Best-effort restore: postMouseMoved exits non-zero if event creation
    // fails, which would leave the cursor at +2,+2. Unreachable once the
    // preflight above has passed, since both calls create the same event type.
    postMouseMoved(to: loc)
    print("\(Int(loc.x)),\(Int(loc.y))")

case "zen":
    // IOPMAssertionDeclareUserActivity only resets the *power management* idle
    // timer (display sleep). It does not reset the input idle timer that chat
    // apps read, so it alone never kept a status green.
    var assertionID: IOPMAssertionID = 0
    let result = IOPMAssertionDeclareUserActivity(
        "AlwaysJiggle" as CFString,
        kIOPMUserActiveLocal,
        &assertionID
    )
    if result == kIOReturnSuccess {
        IOPMAssertionRelease(assertionID)
    }
    // Zero-delta move: a real HID event that resets the input idle timer while
    // leaving the cursor exactly where it is — zen's "no visible movement".
    requirePostAccess()
    guard let ref = CGEvent(source: nil) else { exit(1) }
    postMouseMoved(to: ref.location)

case "idle-time":
    // Must NOT print "0" on failure: 0 means "user is active" to the caller and
    // would permanently suppress every humanized action. Fail loudly instead.
    let service = IOServiceGetMatchingService(0, IOServiceMatching("IOHIDSystem"))
    guard service != 0 else { fputs("IOHIDSystem unavailable\n", stderr); exit(1) }
    defer { IOObjectRelease(service) }
    var cfProps: Unmanaged<CFMutableDictionary>?
    guard IORegistryEntryCreateCFProperties(service, &cfProps, kCFAllocatorDefault, 0) == KERN_SUCCESS,
          let props = cfProps?.takeRetainedValue() as? [String: Any],
          let idleNs = props["HIDIdleTime"] as? UInt64 else {
        fputs("HIDIdleTime unreadable\n", stderr); exit(1)
    }
    print(String(format: "%.3f", Double(idleNs) / 1_000_000_000.0))

case "mouse-drift":
    guard args.count >= 4, let dx = Double(args[2]), let dy = Double(args[3]) else {
        fputs("Usage: jiggle-helper mouse-drift <dx> <dy>\n", stderr); exit(1)
    }
    requirePostAccess()
    guard let ref = CGEvent(source: nil) else { exit(1) }
    let loc = ref.location
    postMouseMoved(to: CGPoint(x: loc.x + dx, y: loc.y + dy))

case "scroll":
    guard args.count >= 3, let amount = Int32(args[2]) else {
        fputs("Usage: jiggle-helper scroll <amount>\n", stderr); exit(1)
    }
    requirePostAccess()
    guard let ev = CGEvent(scrollWheelEvent2Source: nil, units: .pixel,
                           wheelCount: 1, wheel1: amount, wheel2: 0, wheel3: 0) else { exit(1) }
    ev.post(tap: .cghidEventTap)

case "key-safe":
    // Shift key (virtualKey 56) — non-destructive modifier, no visible effect
    requirePostAccess()
    guard let down = CGEvent(keyboardEventSource: nil, virtualKey: 56, keyDown: true),
          let up   = CGEvent(keyboardEventSource: nil, virtualKey: 56, keyDown: false) else { exit(1) }
    down.post(tap: .cghidEventTap)
    usleep(30_000)
    up.post(tap: .cghidEventTap)

default:
    fputs("Unknown command: \(args[1])\n", stderr)
    exit(1)
}
