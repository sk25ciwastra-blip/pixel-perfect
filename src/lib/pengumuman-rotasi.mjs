export const ROTATION_MS = 60_000;
export const TRANSITION_MS = 450;

export function urutPengumuman(rows) {
  return [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

export function indeksBerikut(index, total, step = 1) {
  return total > 0 ? ((index + step) % total + total) % total : 0;
}

export function bolehBerputar(total, paused) {
  return total > 1 && !paused;
}