import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { jamPaket } from '../src/lib/paket-form';
import type { Package } from '../src/lib/data-live';

const sql = readFileSync('drizzle/migrations/0010_short_package_checkin_windows.sql', 'utf8');
describe('Batas check-in resmi WIB', () => {
  for (const [nama, mulai, selesai] of [['Paket 2 Jam','06:00','23:30'],['Paket 4 Jam','06:00','21:30'],['Paket 6 Jam','04:30','19:30']]) {
    it(`${nama}: ${mulai} sampai ${selesai}`, () => {
      const blok = sql.split(`NEW.name = '${nama}'`)[1]?.split(/ELSIF|END IF/)[0] ?? '';
      expect(blok).toContain(`NEW.checkin_start_time := TIME '${mulai}'`);
      expect(blok).toContain(`NEW.checkin_end_time := TIME '${selesai}'`);
      expect(jamPaket({ time_mode: 'duration_midnight_cap', checkin_start_time: mulai, checkin_end_time: selesai } as Package)).toEqual({mulai, selesai});
    });
  }
});