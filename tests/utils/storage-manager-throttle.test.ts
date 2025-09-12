import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StorageManager } from '@/utils/storage-manager'
import type { Task } from '@/types/task'

describe('StorageManager throttle injection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Minimal chrome mock
    const mockChrome = {
      storage: {
        sync: {
          set: vi.fn().mockResolvedValue(undefined),
          get: vi.fn().mockResolvedValue({ tasks: [] }),
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

