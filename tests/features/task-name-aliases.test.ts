import { describe, it, expect } from 'vitest';
import { createTask } from '../../src/types/task.js';

describe('Task name header aliases', () => {
  it('maps "TaskName" to Task.name', () => {
    const t = createTask(['TaskName'], ['Alpha']);
    expect(t.name).toBe('Alpha');
    expect(t.additionalColumns).toEqual({});
  });

  it('maps "Task Name" (with space) to Task.name', () => {
    const t = createTask(['Task Name'], ['Bravo']);
    expect(t.name).toBe('Bravo');
    expect(t.additionalColumns).toEqual({});
  });

  it('maps Japanese "タスク名" to Task.name', () => {
    const t = createTask(['タスク名'], ['チャーリー']);
    expect(t.name).toBe('チャーリー');
    expect(t.additionalColumns).toEqual({});
  });

  it('maps Japanese "タスク" to Task.name', () => {
    const t = createTask(['タスク'], ['デルタ']);
    expect(t.name).toBe('デルタ');
    expect(t.additionalColumns).toEqual({});
  });
});

