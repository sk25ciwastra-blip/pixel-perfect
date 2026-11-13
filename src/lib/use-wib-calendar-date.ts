import { useEffect, useState } from 'react';
import { watchWibCalendar, wibCalendarDate } from './maintenance-calendar';

export function useWibCalendarDate() {
  const [today, setToday] = useState(() => wibCalendarDate());
  useEffect(() => watchWibCalendar(setToday, {
    now: () => Date.now(),
    setTimer: (callback, delay) => window.setTimeout(callback, delay),
    clearTimer: id => window.clearTimeout(id), window, document,
  }), []);
  return today;
}
