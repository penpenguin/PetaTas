import { describe, it, expect } from 'vitest';
import { createTask } from '../../src/types/task.js';

describe('createTask ignores Japanese system columns when requested', () => {
  it('skips 状態 and 終了 columns when ignoreExtensionColumns=true', () => {
    const headers = ['名前', '状態', '終了', '見積(分)'];
    const row = ['Task A', 'done', 'はい', '30'];

    const task = createTask(headers, row, true);

    // Name is mapped from 日本語 header
    expect(task.name).toBe('Task A');
    // Status should remain default because system columns are ignored
    expect(task.status).toBe('todo');
    // additionalColumns should not contain ignored system headers（状態のみ system）
    expect(task.additionalColumns).toBeDefined();
    expect(task.additionalColumns!['状態']).toBeUndefined();
    // 終了はカスタム列として残す
    expect(task.additionalColumns!['終了']).toBe('はい');
    // Non-system header remains
    expect(task.additionalColumns!['見積(分)']).toBe('30');
  });
});
