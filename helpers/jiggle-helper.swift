import CoreGraphics
import Foundation
import IOKit
import IOKit.pwr_mgt

let args = CommandLine.arguments

guard args.count > 1 else {
    fputs("Usage: jiggle-helper [mouse|zen]\n", stderr)
    exit(1)
}

switch args[1] {
case "mouse":
    guard let ref = CGEvent(source: nil) else { exit(1) }
    let loc = ref.location
    // Disassociate so warp isn't immediately overridden by hardware mouse events
    CGAssociateMouseAndMouseCursorPosition(0)
    CGWarpMouseCursorPosition(CGPoint(x: loc.x + 2, y: loc.y + 2))
    // 120ms pause — enough for the display to render the nudge visibly
    usleep(120_000)
    CGWarpMouseCursorPosition(CGPoint(x: loc.x, y: loc.y))
    CGAssociateMouseAndMouseCursorPosition(1)
    print("\(Int(loc.x)),\(Int(loc.y))")

case "zen":
    // IOPMAssertionDeclareUserActivity resets the user idle timer (HIDIdleTime)
    // without any cursor movement and without requiring Accessibility permission.
    // Verified working on macOS Tahoe 26.
    var assertionID: IOPMAssertionID = 0
    let result = IOPMAssertionDeclareUserActivity(
        "AlwaysJiggle" as CFString,
        kIOPMUserActiveLocal,
        &assertionID
    )
    if result == kIOReturnSuccess {
        IOPMAssertionRelease(assertionID)
    }

case "idle-time":
    let service = IOServiceGetMatchingService(0, IOServiceMatching("IOHIDSystem"))
    guard service != 0 else { print("0"); break }
    defer { IOObjectRelease(service) }
    var cfProps: Unmanaged<CFMutableDictionary>?
    guard IORegistryEntryCreateCFProperties(service, &cfProps, kCFAllocatorDefault, 0) == KERN_SUCCESS,
          let props = cfProps?.takeRetainedValue() as? [String: Any],
          let idleNs = props["HIDIdleTime"] as? UInt64 else { print("0"); break }
    print(String(format: "%.3f", Double(idleNs) / 1_000_000_000.0))

case "mouse-drift":
    guard args.count >= 4, let dx = Double(args[2]), let dy = Double(args[3]) else {
        fputs("Usage: jiggle-helper mouse-drift <dx> <dy>\n", stderr); exit(1)
    }
    guard let ref = CGEvent(source: nil) else { exit(1) }
    let loc = ref.location
    CGWarpMouseCursorPosition(CGPoint(x: loc.x + dx, y: loc.y + dy))

case "scroll":
    guard args.count >= 3, let amount = Int32(args[2]) else {
        fputs("Usage: jiggle-helper scroll <amount>\n", stderr); exit(1)
    }
    if let ev = CGEvent(scrollWheelEvent2Source: nil, units: .pixel,
                        wheelCount: 1, wheel1: amount, wheel2: 0, wheel3: 0) {
        ev.post(tap: .cghidEventTap)
    }

case "key-safe":
    // Shift key (virtualKey 56) — non-destructive modifier, no visible effect
    if let down = CGEvent(keyboardEventSource: nil, virtualKey: 56, keyDown: true),
       let up   = CGEvent(keyboardEventSource: nil, virtualKey: 56, keyDown: false) {
        down.post(tap: .cghidEventTap)
        usleep(30_000)
        up.post(tap: .cghidEventTap)
    }

default:
    fputs("Unknown command: \(args[1])\n", stderr)
    exit(1)
}
