import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StorageManager } from '@/utils/storage-manager'
import type { Task } from '@/types/task'

describe('StorageManager throttle injection', () => {
  beforeEach(() => {
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
    vi.useFakeTimers()
    const sm = new StorageManager({ writeThrottleMs: 20 })

    const task: Task = {
      id: 't', name: 'N', status: 'todo', notes: '', elapsedMs: 0,
      createdAt: new Date(), updatedAt: new Date(), additionalColumns: {}
    }

    const p = sm.saveTasks([task])
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(19)
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2)
    await p
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1)
  })

  it('rejects superseded writes for the same key', async () => {
    vi.useFakeTimers()
    const sm = new StorageManager({ writeThrottleMs: 10 })

    const first = sm.saveTimerState({ taskId: 'task-1', isRunning: false, startTime: 0, elapsedMs: 0 })
    const second = sm.saveTimerState({ taskId: 'task-1', isRunning: true, startTime: 1000, elapsedMs: 5000 })

    await expect(first).rejects.toThrow('Write operation replaced by newer write')

    await vi.advanceTimersByTimeAsync(11)
    await expect(second).resolves.toBeUndefined()

    const setMock = chrome.storage.sync.set as ReturnType<typeof vi.fn>
    expect(setMock).toHaveBeenCalledTimes(1)
    expect(setMock.mock.calls[0][0]).toEqual({
      'timer_task-1': { taskId: 'task-1', isRunning: true, startTime: 1000, elapsedMs: 5000 }
    })
  })

  it('defers batch writes when approaching rate limits', async () => {
    vi.useFakeTimers()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'))

    const sm = new StorageManager({ writeThrottleMs: 10, maxWritesPerMinute: 2 })
    ;(sm as unknown as { writeHistory: number[] }).writeHistory = [Date.now() - 1000, Date.now() - 2000]

    const pending = sm.saveTimerState({ taskId: 'limit', isRunning: false, startTime: 0, elapsedMs: 0 })

    await vi.advanceTimersByTimeAsync(11)

    expect(warnSpy).toHaveBeenCalledWith('Approaching write rate limit, delaying writes')
    expect(chrome.storage.sync.set).not.toHaveBeenCalled()

    warnSpy.mockClear()
    ;(sm as unknown as { writeHistory: number[] }).writeHistory = []
    await vi.advanceTimersByTimeAsync(11)
    await pending

    warnSpy.mockRestore()
  })

  it('propagates quota errors and logs diagnostics', async () => {
    vi.useFakeTimers()
    const setMock = chrome.storage.sync.set as ReturnType<typeof vi.fn>
    setMock.mockRejectedValueOnce(new Error('MAX_WRITE_OPERATIONS_PER_MINUTE reached'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const sm = new StorageManager({ writeThrottleMs: 10 })
    const promise = sm.saveTimerState({ taskId: 'quota', isRunning: false, startTime: 0, elapsedMs: 0 }).catch(error => error)

    await vi.advanceTimersByTimeAsync(11)

    const result = await promise
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toContain('MAX_WRITE_OPERATIONS_PER_MINUTE reached')
    expect(errorSpy).toHaveBeenCalledWith('Batch write failed:', expect.any(Error))
    expect(warnSpy).toHaveBeenCalledWith('Storage quota exceeded, increasing throttle delay')

    warnSpy.mockRestore()
    errorSpy.mockRestore()
    setMock.mockResolvedValue(undefined)
    await vi.advanceTimersByTimeAsync(30)
  })
})
