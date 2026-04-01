import CoreGraphics
import Foundation
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

default:
    fputs("Unknown command: \(args[1])\n", stderr)
    exit(1)
}
