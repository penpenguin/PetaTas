import { describe, expect, it } from 'vitest';

import { formatHms, minutesToMs, msToMinutes, parseTimerToMs } from '@/utils/time-utils';

describe('parseTimerToMs', () => {
  it('parses colon format with hours', () => {
    expect(parseTimerToMs('02:03:04')).toBe(2 * 3600 * 1000 + 3 * 60 * 1000 + 4 * 1000);
  });

  it('parses minute-second format', () => {
    expect(parseTimerToMs('15:30')).toBe((15 * 60 + 30) * 1000);
  });

  it('returns zero when seconds segment is negative', () => {
    expect(parseTimerToMs('05:-30')).toBe(0);
  });

  it('parses seconds-only token format', () => {
    expect(parseTimerToMs('45s')).toBe(45 * 1000);
  });

  it('returns zero for whitespace-only input', () => {
    expect(parseTimerToMs('   ')).toBe(0);
  });

  it('parses token-based format', () => {
    expect(parseTimerToMs('1h 5m 30s')).toBe(((1 * 60 + 5) * 60 + 30) * 1000);
  });

  it('rejects strings with non-time prefixes', () => {
    expect(parseTimerToMs('draft 1h 5m')).toBe(0);
  });
});

describe('formatHms', () => {
  it('pads each unit to two digits', () => {
    expect(formatHms(5 * 1000)).toBe('00:00:05');
    expect(formatHms(65 * 1000)).toBe('00:01:05');
  });
});

describe('minutesToMs', () => {
  it('clamps negative values to zero', () => {
    expect(minutesToMs(-5)).toBe(0);
    expect(minutesToMs(2)).toBe(2 * 60 * 1000);
  });
});

describe('msToMinutes', () => {
  it('rounds to the nearest minute', () => {
    expect(msToMinutes(90_000)).toBe(2);
  });
});
