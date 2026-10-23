export const ROTATION_MS: number;
export const TRANSITION_MS: number;
export function urutPengumuman<T extends { id: string; created_at: string }>(rows: T[]): T[];
export function indeksBerikut(index: number, total: number, step?: number): number;
export function bolehBerputar(total: number, paused: boolean): boolean;