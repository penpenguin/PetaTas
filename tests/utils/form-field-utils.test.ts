import { describe, it, expect } from 'vitest';
import { getFieldLabel, getFieldPlaceholder, validateFieldInput } from '@/utils/form-field-utils';

describe('utils/form-field-utils', () => {
  it('provides labels and placeholders', () => {
    expect(getFieldLabel('name')).toBe('Task Name');
    expect(getFieldPlaceholder('name')).toContain('Enter task name');
    expect(getFieldLabel('priority')).toBe('Priority');
  });

  it('validates field inputs', () => {
    expect(validateFieldInput('validHeader', 'ok')).toBe(true);
    expect(validateFieldInput('invalid<', 'x')).toBe(false);
    expect(validateFieldInput('a'.repeat(101), 'x')).toBe(false);
    expect(validateFieldInput('ok', 'v'.repeat(1001))).toBe(false);
  });
});

