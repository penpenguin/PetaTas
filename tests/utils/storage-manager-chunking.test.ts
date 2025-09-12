import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StorageManager } from '@/utils/storage-manager'
import type { Task } from '@/types/task'

function makeTask(i: number): Task {
  const now = new Date()
  return {
    id: `t${i}`,
    name: `Task ${i}`,
    status: 'todo',
    notes: `notes-${i}`,
    elapsedMs: 0,
    createdAt: now,
    updatedAt: now,
    additionalColumns: { col: `v${i}` }
  }
}

describe('StorageManager chunked sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads tasks from chunked storage using tasks_index', async () => {
    const tasksA = [makeTask(1), makeTask(2)]
    const tasksB = [makeTask(3)]
    const index = { version: 1, chunks: ['tasks_0', 'tasks_1'], total: 3, updatedAt: Date.now() }

    // Mock chrome.storage.sync.get behavior
    const getMock = (global.chrome.storage.sync.get as unknown as ReturnType<typeof vi.fn>)
    getMock.mockImplementation(async (keys: any) => {
      if (keys === 'tasks_index') {
        return { tasks_index: index }
      }
      if (Array.isArray(keys)) {
        const out: Record<string, unknown> = {}
        for (const k of keys) {
          if (k === 'tasks_0') out[k] = tasksA
          if (k === 'tasks_1') out[k] = tasksB
        }
        return out
      }
      return {}
    })

    const mgr = new StorageManager({ writeThrottleMs: 1 })
    const loaded = await mgr.loadTasks()

    expect(loaded).toHaveLength(3)
    // Dates should be restored
    loaded.forEach(t => {
      expect(t.createdAt).toBeInstanceOf(Date)
      expect(t.updatedAt).toBeInstanceOf(Date)
    })
  })

  it('saves tasks into chunks and writes tasks_index last (batched)', async () => {
    // Use fake timers to flush throttling quickly
    vi.useFakeTimers()

    const setMock = (global.chrome.storage.sync.set as unknown as ReturnType<typeof vi.fn>)
    setMock.mockResolvedValue(undefined)

    // Keep get minimal for this test
    const getMock = (global.chrome.storage.sync.get as unknown as ReturnType<typeof vi.fn>)
    getMock.mockResolvedValue({})

    // Prepare a few tasks; force small chunk size via constructor option
    const tasks = Array.from({ length: 5 }, (_, i) => makeTask(i + 1))
    // Inflate notes so that items exceed tiny test chunk threshold
    tasks.forEach(t => { t.notes = 'x'.repeat(200) })

    const mgr = new StorageManager({ writeThrottleMs: 1, maxWritesPerMinute: 100 }, { targetChunkBytes: 400 })
    const p = mgr.saveTasks(tasks)

    // Advance time to execute queued write
    await vi.advanceTimersByTimeAsync(5)
    await p

    // Expect one or more batched set calls; inspect the last call args contain tasks_index
    expect(setMock).toHaveBeenCalled()
    const lastCallArgs = setMock.mock.calls[setMock.mock.calls.length - 1][0]
    expect(lastCallArgs).toHaveProperty('tasks_index')
    // Should write at least one chunk key
    const hasChunkKey = Object.keys(lastCallArgs).some(k => /^tasks_\d+$/.test(k))
    expect(hasChunkKey).toBe(true)
  })

  // No backward compatibility: absence of tasks_index returns empty
  it('returns empty array when tasks_index is missing', async () => {
    const getMock = (global.chrome.storage.sync.get as unknown as ReturnType<typeof vi.fn>)
    getMock.mockImplementation(async (_keys: any) => ({}))

    const mgr = new StorageManager({ writeThrottleMs: 1 })
    const loaded = await mgr.loadTasks()
    expect(loaded).toEqual([])
  })
})
