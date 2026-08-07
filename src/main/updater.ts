import pkg from '../../package.json';
import { UpdateInfo } from './types';

// Two checks a day. Deliberately *not* a setInterval: timers do not advance
// while the machine is asleep, so a laptop that sleeps overnight would drift a
// 12h timer by hours and a machine that sleeps more than it runs could go days
// without firing. Callers poll maybeCheck() instead and the deadline is
// compared against wall-clock time, which sleep cannot skew.
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
// A failed check must not burn the full 12h window — see maybeCheck.
const RETRY_INTERVAL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

let cached: UpdateInfo | null = null;
let nextCheckMs = 0; // wall-clock deadline; 0 means "check on the next call"

/**
 * True only when `latest` is a strictly higher major.minor.patch than `current`.
 * A plain `!==` would also fire when the local build is *ahead* of the published
 * release, offering the user a downgrade.
 * Anything unparseable is treated as "no update" rather than guessing.
 */
function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (Number.isNaN(x) || Number.isNaN(y)) return false;
    if (x !== y) return x > y;
  }
  return false;
}

async function fetchLatest(): Promise<void> {
  const res = await fetch(
    'https://api.github.com/repos/ncesar/AlwaysJiggle/releases/latest',
    {
      headers: { 'User-Agent': 'AlwaysJiggle-updater' },
      // Without this a captive portal can hang the request indefinitely.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );
  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  const data = await res.json() as { tag_name: string; html_url: string };
  const latest = data.tag_name.replace(/^v/i, '');
  cached = {
    hasUpdate: isNewer(latest, pkg.version.replace(/^v/i, '')),
    latestVersion: latest,
    releaseUrl: data.html_url,
  };
}

/**
 * Checks at most once per CHECK_INTERVAL_MS; cheap to call often.
 * Returns true when the known release changed, so the caller can refresh the
 * tray and the popup only when there is something new to show.
 */
export async function maybeCheck(): Promise<boolean> {
  if (Date.now() < nextCheckMs) return false;
  // Pushed out before the await, not after: a request that hangs until its
  // timeout must not let the next poll 30s later start a second one alongside it.
  nextCheckMs = Date.now() + CHECK_INTERVAL_MS;

  const before = cached?.latestVersion ?? null;
  try {
    await fetchLatest();
  } catch (err) {
    // Offline, rate-limited (the GitHub API allows 60/hr per IP, and an office
    // NAT shares one), or GitHub is down.
    //
    // Retried well before the next 12h slot, because the two moments this runs —
    // app launch and wake from sleep — are exactly when Wi-Fi has not associated
    // yet. Holding the full window there means a laptop that wakes once a day can
    // fail forever and never show a badge, which is the silent-no-op failure this
    // codebase is most prone to. One retry per 10 min is far inside the rate limit.
    console.warn('[updater] check failed, retrying in %d min:', RETRY_INTERVAL_MS / 60_000, err);
    nextCheckMs = Date.now() + RETRY_INTERVAL_MS;
    return false;
  }
  // `cached` is left alone on failure above — a transient blip must not erase a
  // notice already on screen.
  return (cached?.latestVersion ?? null) !== before;
}

export function getUpdateInfo(): UpdateInfo | null {
  return cached;
}

export function hasUpdate(): boolean {
  return cached?.hasUpdate === true;
}
