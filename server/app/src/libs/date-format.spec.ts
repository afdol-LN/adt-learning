import { DateFormat } from './date-format';

describe('DateFormat.toBangkokDateString', () => {
  it('returns the Thai calendar day even when UTC is still on the previous day', () => {
    // 20:30 UTC on 2026-10-12 is 03:30 on 2026-10-13 in Bangkok
    expect(
      DateFormat.toBangkokDateString(new Date('2026-10-12T20:30:00Z')),
    ).toBe('2026-10-13');
  });

  it('returns the same day when both zones agree', () => {
    expect(
      DateFormat.toBangkokDateString(new Date('2026-10-13T05:00:00Z')),
    ).toBe('2026-10-13');
  });
});
