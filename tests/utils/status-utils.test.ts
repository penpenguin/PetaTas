import { describe, it, expect } from 'vitest';
import { getRowStatusClasses, getStatusBadge } from '@/utils/status-utils';

describe('utils/status-utils', () => {
  it('maps status to border classes', () => {
    expect(getRowStatusClasses('todo')).toContain('border-base-300');
    expect(getRowStatusClasses('in-progress')).toContain('border-warning');
    expect(getRowStatusClasses('done')).toContain('border-success');
  });

  it('returns correct badge metadata', () => {
    const done = getStatusBadge('done');
    expect(done.cls).toBe('badge-success');
    expect(done.text).toBe('DONE');
    expect(done.aria).toBe('Status: DONE');
    expect(done.icon).toContain('svg');
  });
});

