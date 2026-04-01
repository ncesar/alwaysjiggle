import CoreGraphics
import Foundation

let args = CommandLine.arguments

guard args.count > 1 else {
    fputs("Usage: jiggle-helper [mouse|key]\n", stderr)
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

case "key":
    guard let ref = CGEvent(source: nil) else { exit(0) }
    let loc = ref.location
    CGAssociateMouseAndMouseCursorPosition(0)
    CGWarpMouseCursorPosition(CGPoint(x: loc.x + 1, y: loc.y))
    usleep(120_000)
    CGWarpMouseCursorPosition(CGPoint(x: loc.x, y: loc.y))
    CGAssociateMouseAndMouseCursorPosition(1)

default:
    fputs("Unknown command: \(args[1])\n", stderr)
    exit(1)
}
