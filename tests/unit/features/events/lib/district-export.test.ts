import { describe, expect, it } from 'vitest';

import { DISTRICT_COLUMNS, toCsv, type DistrictRow } from '@/features/events/lib/district-export';

const row = (values: Partial<DistrictRow>): DistrictRow => ({
  ...(Object.fromEntries(DISTRICT_COLUMNS.map((column) => [column, null])) as DistrictRow),
  ...values,
});

describe('district CSV', () => {
  it('writes a BOM, the header and CRLF rows (RFC 4180)', () => {
    const csv = toCsv([row({ district_id: 'TR-34-1', name: 'Fatih', mmi: 8.2 })]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe(DISTRICT_COLUMNS.join(','));
    expect(lines[1]).toBe(`TR-34-1,Fatih,,,,8.2${','.repeat(DISTRICT_COLUMNS.length - 6)}`);
    expect(lines[2]).toBe('');
  });

  it('quotes fields with commas, quotes or line breaks and leaves missing values empty', () => {
    const csv = toCsv([
      row({ name: 'A, "B"', province: 'x\ny', stock_estimated: true, fire_after_min: null }),
    ]);
    const fields = csv.slice(1).split('\r\n')[1];
    expect(fields).toContain('"A, ""B""","x\ny"');
    expect(fields).toContain(',true,');
  });
});
