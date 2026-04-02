const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
// ── DOM helpers ───────────────────────────────────────────────────────────────
function el(id) {
    return document.getElementById(id);
}
// ── Schedule rendering ────────────────────────────────────────────────────────
function renderSchedules(schedules) {
    const list = el('schedules-list');
    const hint = el('schedule-hint');
    hint.style.display = schedules.length === 0 ? 'block' : 'none';
    list.innerHTML = '';
    schedules.forEach(schedule => {
        const row = document.createElement('div');
        row.className = 'schedule-row';
        row.dataset.id = schedule.id;
        const daysHtml = DAY_LABELS.map((label, idx) => `<button class="day-btn${schedule.days.includes(idx) ? ' active' : ''}" data-day="${idx}">${label}</button>`).join('');
        row.innerHTML = `
      <div class="schedule-row-header">
        <label class="schedule-toggle">
          <input type="checkbox" class="sched-enabled" ${schedule.enabled ? 'checked' : ''}>
          <span>Active</span>
        </label>
        <button class="schedule-delete" title="Remove">✕</button>
      </div>
      <div class="schedule-days">${daysHtml}</div>
      <div class="schedule-time">
        <input type="time" class="time-input sched-start" value="${schedule.startTime}">
        <span>to</span>
        <input type="time" class="time-input sched-end" value="${schedule.endTime}">
      </div>
    `;
        // Enable toggle
        const enabledCb = row.querySelector('.sched-enabled');
        enabledCb.addEventListener('change', () => {
            patchSchedule(schedule.id, { enabled: enabledCb.checked });
        });
        // Delete button
        const deleteBtn = row.querySelector('.schedule-delete');
        deleteBtn.addEventListener('click', () => removeSchedule(schedule.id));
        // Day buttons
        row.querySelectorAll('.day-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const day = parseInt(btn.dataset.day ?? '0', 10);
                const newDays = schedule.days.includes(day)
                    ? schedule.days.filter(d => d !== day)
                    : [...schedule.days, day].sort((a, b) => a - b);
                patchSchedule(schedule.id, { days: newDays });
            });
        });
        // Time inputs
        const startInput = row.querySelector('.sched-start');
        const endInput = row.querySelector('.sched-end');
        startInput.addEventListener('change', () => {
            patchSchedule(schedule.id, { startTime: startInput.value });
        });
        endInput.addEventListener('change', () => {
            patchSchedule(schedule.id, { endTime: endInput.value });
        });
        list.appendChild(row);
    });
}
async function patchSchedule(id, changes) {
    const state = await window.electronAPI.getState();
    const updated = state.schedules.map(s => s.id === id ? { ...s, ...changes } : s);
    await window.electronAPI.setState({ schedules: updated });
}
async function removeSchedule(id) {
    const state = await window.electronAPI.getState();
    const updated = state.schedules.filter(s => s.id !== id);
    await window.electronAPI.setState({ schedules: updated });
}
async function addSchedule() {
    const state = await window.electronAPI.getState();
    const newSchedule = {
        id: `sched_${Date.now()}`,
        enabled: true,
        days: [1, 2, 3, 4, 5], // Mon–Fri
        startTime: '09:00',
        endTime: '17:00',
    };
    await window.electronAPI.setState({ schedules: [...state.schedules, newSchedule] });
}
// ── Pause countdown ───────────────────────────────────────────────────────────
let countdownInterval = null;
function formatRemaining(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0)
        return `Paused — ${h}h ${m}m remaining`;
    if (m > 0)
        return `Paused — ${m}m ${s}s remaining`;
    return `Paused — ${s}s remaining`;
}
function startCountdown(untilMs) {
    stopCountdown();
    const label = el('pause-label');
    const update = () => {
        const remaining = untilMs - Date.now();
        if (remaining <= 0) {
            stopCountdown();
            return;
        }
        label.textContent = formatRemaining(remaining);
    };
    update();
    countdownInterval = setInterval(update, 1000);
}
function stopCountdown() {
    if (countdownInterval !== null) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
}
// ── Apply state to UI ─────────────────────────────────────────────────────────
function applyStateToUI(state) {
    (el('enabled')).checked = state.enabled;
    const modeRadio = document.querySelector(`input[name="mode"][value="${state.mode}"]`);
    if (modeRadio)
        modeRadio.checked = true;
    (el('interval')).value = String(state.interval);
    (el('interval')).disabled = state.mode === 'humanized';
    (el('neverOnBattery')).checked = state.neverOnBattery;
    (el('neverOnLockScreen')).checked = state.neverOnLockScreen;
    (el('launchOnLogin')).checked = state.launchOnLogin;
    // Timed pause bar
    const pauseBar = el('pause-bar');
    if (state.pauseUntil !== null && state.pauseUntil > Date.now()) {
        pauseBar.style.display = 'flex';
        startCountdown(state.pauseUntil);
    }
    else {
        pauseBar.style.display = 'none';
        stopCountdown();
    }
    renderSchedules(state.schedules);
}
// ── Wiring ────────────────────────────────────────────────────────────────────
async function init() {
    const state = await window.electronAPI.getState();
    applyStateToUI(state);
    // Push updates from main (e.g., conditions block/unblock)
    window.electronAPI.onStateChanged(applyStateToUI);
    // Enable toggle
    el('enabled').addEventListener('change', e => {
        window.electronAPI.setState({ enabled: e.target.checked });
    });
    // Mode
    document.querySelectorAll('input[name="mode"]').forEach(radio => {
        radio.addEventListener('change', e => {
            const value = e.target.value;
            window.electronAPI.setState({ mode: value });
        });
    });
    // Interval
    el('interval').addEventListener('change', e => {
        window.electronAPI.setState({ interval: parseInt(e.target.value, 10) });
    });
    // Never-jiggle conditions
    el('neverOnBattery').addEventListener('change', e => {
        window.electronAPI.setState({ neverOnBattery: e.target.checked });
    });
    el('neverOnLockScreen').addEventListener('change', e => {
        window.electronAPI.setState({ neverOnLockScreen: e.target.checked });
    });
    // Launch on login
    el('launchOnLogin').addEventListener('change', e => {
        window.electronAPI.setState({ launchOnLogin: e.target.checked });
    });
    // Pause menu toggle
    el('pause-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = el('pause-menu');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });
    // Close pause menu when clicking outside
    document.addEventListener('click', () => {
        el('pause-menu').style.display = 'none';
    });
    // Pause options
    document.querySelectorAll('.pause-option').forEach(btn => {
        btn.addEventListener('click', () => {
            el('pause-menu').style.display = 'none';
            const minutes = btn.dataset.minutes;
            const until = btn.dataset.until;
            let untilMs;
            if (until === 'tomorrow') {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0, 0, 0, 0);
                untilMs = tomorrow.getTime();
            }
            else {
                untilMs = Date.now() + parseInt(minutes, 10) * 60 * 1000;
            }
            window.electronAPI.pauseUntil(untilMs);
        });
    });
    // Resume button in pause bar
    el('pause-resume-btn').addEventListener('click', () => {
        window.electronAPI.setState({ enabled: true });
    });
    // Add schedule
    el('add-schedule').addEventListener('click', addSchedule);
    // Close popup
    el('close-btn').addEventListener('click', () => {
        window.electronAPI.closePopup();
    });
    // Open Accessibility settings
    el('open-accessibility').addEventListener('click', e => {
        e.preventDefault();
        // Trigger main to open System Preferences via shell
        // We reuse setState as a simple message carrier
        window.electronAPI.setState({});
    });
    // Quit
    el('quit-btn').addEventListener('click', () => {
        window.electronAPI.quit();
    });
}
init().catch(console.error);
export {};
//# sourceMappingURL=renderer.js.map