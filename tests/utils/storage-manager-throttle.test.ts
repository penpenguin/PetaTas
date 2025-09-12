import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StorageManager } from '@/utils/storage-manager'
import type { Task } from '@/types/task'

describe('StorageManager throttle injection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Minimal chrome mock
    const tasks: Task[] = []
    const mockChrome = {
      storage: {
        sync: {
          set: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockImplementation(async (keys: any) => {
            const index = { version: 1, chunks: ['tasks_0'], total: tasks.length, updatedAt: 0 }
            if (keys === 'tasks_index') return { tasks_index: index }
            if (Array.isArray(keys)) {
              const out: Record<string, unknown> = {}
              for (const k of keys) if (k === 'tasks_0') out[k] = tasks
              return out
            }
            return {}
          }),
          clear: vi.fn(),
          remove: vi.fn(),
          getBytesInUse: vi.fn().mockResolvedValue(0),
        },
      },
    }
    // @ts-expect-error test env
    global.chrome = mockChrome
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('delays writes according to provided writeThrottleMs', async () => {
    const sm = new StorageManager({ writeThrottleMs: 20 })

    const task: Task = {
      id: 't', name: 'N', status: 'todo', notes: '', elapsedMs: 0,
      createdAt: new Date(), updatedAt: new Date(), additionalColumns: {}
    }

    const p = sm.saveTasks([task])
    // Not yet called before throttle delay elapses
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(19)
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2)
    await p // resolve after batch write executes
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1)
  })
})
