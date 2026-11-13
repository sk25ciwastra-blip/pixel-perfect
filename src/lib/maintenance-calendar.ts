const DAY_MS = 86400000;
const wibFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit',
});

export function wibCalendarDate(now = Date.now()) {
  const parts = wibFormatter.formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function calendarDay(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
    ? timestamp / DAY_MS : null;
}

/** Missing/invalid history must not silently hide maintenance. Never rewrites operational_date. */
export function maintenanceIsDue(lastDate: string | undefined, intervalDays: number, today: string) {
  const last = calendarDay(lastDate), current = calendarDay(today);
  if (last === null || current === null || !Number.isSafeInteger(intervalDays) || intervalDays < 0) return true;
  return current - last >= intervalDays;
}

type CalendarEvents = {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};
export type WibCalendarEnvironment = {
  now: () => number;
  setTimer: (callback: () => void, delay: number) => number;
  clearTimer: (id: number) => void;
  window: CalendarEvents;
  document: CalendarEvents & { readonly visibilityState: string };
};

/** One midnight timer; focus/visibility/pageshow repair throttled or suspended tabs. */
export function watchWibCalendar(changed: (date: string) => void, env: WibCalendarEnvironment) {
  let active = true, lastDate: string | undefined, timer: number | undefined;
  const sync = () => {
    if (!active) return;
    const now = env.now(), date = wibCalendarDate(now);
    if (date !== lastDate) { lastDate = date; changed(date); }
    if (!active) return;
    if (timer !== undefined) env.clearTimer(timer);
    // Jakarta is UTC+07:00. Recompute from the wall clock on every resume, not timer ticks.
    const nextMidnight = Date.parse(date + 'T00:00:00+07:00') + DAY_MS;
    timer = env.setTimer(sync, Math.max(1, nextMidnight - now));
  };
  const visible = () => { if (env.document.visibilityState === 'visible') sync(); };
  env.window.addEventListener('focus', sync);
  env.window.addEventListener('pageshow', sync);
  env.document.addEventListener('visibilitychange', visible);
  sync();
  return () => {
    active = false;
    if (timer !== undefined) env.clearTimer(timer);
    env.window.removeEventListener('focus', sync);
    env.window.removeEventListener('pageshow', sync);
    env.document.removeEventListener('visibilitychange', visible);
  };
}
