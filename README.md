# AlwaysJiggle

A mouse jiggler for macOS that lives in your menu bar — keep your Mac awake and your Slack or Teams status green, without opening a Terminal.

**[alwaysjiggle.cesar.dev.br](https://alwaysjiggle.cesar.dev.br)** · [Download the latest release](../../releases/latest)

[![Latest release](https://img.shields.io/github/v/release/ncesar/AlwaysJiggle?label=release)](../../releases/latest)
[![Downloads](https://img.shields.io/github/downloads/ncesar/AlwaysJiggle/total?label=downloads)](../../releases)
![Platform](https://img.shields.io/badge/platform-macOS%20Apple%20Silicon-black)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](#license)

![AlwaysJiggle screenshot](screenshot.png)

Most jigglers wiggle the pointer and hope for the best. AlwaysJiggle posts real input
events, so the idle timer that Slack and Teams actually read gets reset and your status
stays green. It also knows when to stop: it follows your work schedule, backs off while
you're genuinely typing, and pauses itself on battery.

---

## Features

Three ways to keep your Mac awake, plus the guardrails that stop it running when you're
not working.

- **Standard mode** — nudges the mouse cursor by 2px and back every N seconds
- **Zen mode** — keeps the display awake and resets the idle timer with no visible cursor movement
- **Humanized mode** — irregular timing with randomized bursts, breaks, and idle phases to mimic real human activity
- **Schedules** — configure active days and time windows (e.g. Mon–Fri, 9am–5pm)
- **Smart pausing** — auto-pauses on battery, on lock screen, or for a timed duration (15 min / 1 hour / until tomorrow)
- **Launch on login** — starts automatically with macOS

> **All three modes require Accessibility permission.** macOS only counts real input
> events toward the idle timer that Slack and Teams read — simply moving the cursor
> does not keep a status active.

---

## Why not just use `caffeinate`?

`caffeinate -di` keeps the display on, and that is the whole feature. It will not keep a
Slack or Teams status green, because those read the input idle timer — and only real
input events reset that. A Terminal window left running in the background does nothing
for it.

A macOS jiggler is the other half of the job, and AlwaysJiggle adds the parts a shell
loop doesn't have:

- **Three modes**, including a humanized one with irregular bursts and breaks instead of a metronome tick
- **A work schedule** — Mon–Fri, 9am–5pm, then it stops on its own
- **Battery and lock-screen awareness** — no quietly draining the laptop in your bag
- **A menu bar UI** — switch modes, pause for an hour, quit; no flags to remember, no Terminal window to keep open

---

## Download

Go to the [Releases](../../releases) page and download the latest `.dmg` for Apple Silicon (arm64).

### "AlwaysJiggle is damaged and can't be opened"

Because the app isn't notarized with an Apple Developer certificate, macOS Gatekeeper will block it. Run this once in Terminal after moving it to Applications:

```sh
xattr -cr /Applications/AlwaysJiggle.app
```

Then open it normally.

### Grant Accessibility permission

On first launch AlwaysJiggle asks macOS for Accessibility access and you get the
standard system dialog — click **Open System Settings** and switch AlwaysJiggle on.
You should not need to find the pane yourself or use the **+** button.

The app shows a warning banner whenever the permission is missing, and the menu bar
icon turns ⚠️.

### Updating from v1.1.3 or earlier — one-time extra step

**Upgrading to v1.1.4 drops your Accessibility permission once.** Before v1.1.4 each
build was signed ad hoc, which tied the permission to that exact build; from v1.1.4
onward releases are signed with a stable certificate, so the permission carries across
updates and this stops happening.

Because the old and new builds have different identities, macOS leaves the old entry
behind looking enabled while granting nothing. So this one time:

1. Open **System Settings → Privacy & Security → Accessibility**
2. Select the existing **AlwaysJiggle** row and remove it with **−**
3. Launch the new version and grant access when the dialog appears

Updates after v1.1.4 keep the permission and need none of this.

---

## Running locally

### Prerequisites

- Node.js 18+
- npm
- macOS (Apple Silicon recommended)
- Xcode Command Line Tools (for the Swift helper)

### Setup

```sh
git clone https://github.com/ncesar/AlwaysJiggle.git
cd AlwaysJiggle
npm install
```

### Compile the Swift helper

The native helper binary is already compiled and committed at `helpers/jiggle-helper`. If you need to recompile it:

```sh
swiftc -target arm64-apple-macos12.0 helpers/jiggle-helper.swift -o helpers/jiggle-helper
```

The `-target` flag is required. Without it `swiftc` targets whatever macOS version the
build machine runs, which links Swift overlay libraries that do not exist on older
systems. The helper then fails to load for every user on an older macOS while the app
itself still launches, so the app appears to work but nothing jiggles.

### Start in development

```sh
npm start
```

This compiles TypeScript and launches Electron. The app will appear in your menu bar.

### Build a distributable `.dmg`

```sh
npm run dist
```

The output is placed in the `release/` folder.

---

## Project structure

```
src/
  main/
    index.ts          # App entry, IPC handlers
    tray.ts           # Menu bar tray + popup window
    jiggleEngine.ts   # Start/stop/pause/resume orchestration
    humanEngine.ts    # Humanized timing state machine
    conditions.ts     # Battery and lock screen monitoring
    scheduler.ts      # Schedule evaluation
    helper.ts         # Swift helper path resolution, invocation, health probe
    store.ts          # Persistent settings (electron-store)
    preload.ts        # Context bridge for renderer IPC
    types.ts          # Shared TypeScript interfaces
  renderer/
    index.html        # Popup UI
    renderer.ts       # UI logic and state binding
    style.css         # Styles
helpers/
  jiggle-helper.swift # Native Swift helper source (mouse, zen, idle, scroll, key)
  jiggle-helper       # Compiled arm64 binary, committed to the repo
```

---

## Contributing

Contributions are welcome. A few guidelines:

1. Fork the repo and create a branch from `main`
2. Keep changes focused — one feature or fix per PR
3. Run `npm start` to verify nothing is broken before opening a PR
4. Open a PR with a clear description of what and why

If you find a bug or have a feature idea, open an issue first so we can discuss it.

---

## About the developer

Built by [César Nascimento](https://linkedin.com/in/cesarnascimentoo), a fullstack developer. Feel free to connect.

---

## License

MIT
