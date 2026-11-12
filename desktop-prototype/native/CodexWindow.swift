// PROTOTYPE: window metadata only. No screenshots, Accessibility access, or window control.
import AppKit
import CoreGraphics

func snapshot() -> [String: Any] {
    let apps = NSWorkspace.shared.runningApplications.filter {
        $0.bundleIdentifier == "com.openai.codex" || $0.localizedName?.lowercased() == "codex"
    }
    let pids = Set(apps.map { $0.processIdentifier })
    guard !pids.isEmpty else { return ["visible": false, "reason": "Open Codex to attach the companion."] }
    let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
    let frontmost = NSWorkspace.shared.frontmostApplication?.processIdentifier
    for window in windows {
        guard let pid = window[kCGWindowOwnerPID as String] as? Int32, pids.contains(pid),
              (window[kCGWindowLayer as String] as? Int) == 0,
              let raw = window[kCGWindowBounds as String] as? NSDictionary,
              let bounds = CGRect(dictionaryRepresentation: raw), bounds.width >= 300, bounds.height >= 200
        else { continue }
        return ["visible": true, "frontmost": frontmost == pid, "windowId": window[kCGWindowNumber as String] ?? 0,
                "bounds": ["x": bounds.origin.x, "y": bounds.origin.y, "width": bounds.width, "height": bounds.height]]
    }
    return ["visible": false, "reason": "No visible Codex window. The companion will reconnect when it returns."]
}
var previous = ""
func publish() {
    guard let data = try? JSONSerialization.data(withJSONObject: snapshot(), options: [.sortedKeys]),
          let line = String(data: data, encoding: .utf8), line != previous else { return }
    previous = line
    print(line)
    fflush(stdout)
}
publish()
if !CommandLine.arguments.contains("--once") {
    let timer = Timer(timeInterval: 1.0 / 60.0, repeats: true) { _ in
        autoreleasepool { publish() }
    }
    timer.tolerance = 0.001
    RunLoop.main.add(timer, forMode: .common)
    RunLoop.main.run()
}
