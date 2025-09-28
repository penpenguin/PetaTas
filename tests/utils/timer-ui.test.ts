import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TimerUI from '@/utils/timer-ui'

const createBaseTask = () => ({
  id: 'task-1',
  title: 'Test task',
  status: 'todo' as const,
  elapsedMs: 0,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-01T00:00:00.000Z')
})

describe('TimerUI', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  const createTimerUI = () => {
    const tasks = [createBaseTask()]
    const getTasks = () => tasks
    const saveTasks = vi.fn(async () => {})
    const updateTaskRowVisualState = vi.fn()
    const updateTimerButtonState = vi.fn()

    const timerUI = new TimerUI({
      getTasks,
      saveTasks,
      updateTaskRowVisualState,
      updateTimerButtonState
    })

    return { tasks, timerUI, saveTasks, updateTaskRowVisualState, updateTimerButtonState }
  }

  it('starts a timer for todo tasks and updates UI state', () => {
    const { timerUI, updateTaskRowVisualState, updateTimerButtonState, saveTasks, tasks } = createTimerUI()
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))

    timerUI.toggle('task-1')

    expect(timerUI.isRunning('task-1')).toBe(true)
    expect(tasks[0].status).toBe('in-progress')
    expect(updateTaskRowVisualState).toHaveBeenCalledWith('task-1', 'in-progress')
    expect(updateTimerButtonState).toHaveBeenCalledWith('task-1', true)
    expect(saveTasks).toHaveBeenCalled()
  })

  it('does not restart a completed task timer', () => {
    const { timerUI, updateTimerButtonState, tasks } = createTimerUI()
    tasks[0].status = 'done'

    timerUI.toggle('task-1')

    expect(timerUI.isRunning('task-1')).toBe(false)
    expect(updateTimerButtonState).toHaveBeenCalledWith('task-1', false)
  })

  it('stops a running timer, persists state, and restores task status', async () => {
    const { timerUI, updateTaskRowVisualState, updateTimerButtonState, saveTasks, tasks } = createTimerUI()
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
    timerUI.toggle('task-1')
    expect(timerUI.isRunning('task-1')).toBe(true)

    vi.setSystemTime(new Date('2024-01-01T00:00:02.000Z'))
    timerUI.toggle('task-1')

    expect(timerUI.isRunning('task-1')).toBe(false)
    expect(tasks[0].elapsedMs).toBe(2000)
    expect(updateTaskRowVisualState).toHaveBeenCalledWith('task-1', 'todo')
    expect(updateTimerButtonState).toHaveBeenLastCalledWith('task-1', false)
    expect(saveTasks).toHaveBeenCalledTimes(2)
  })

  it('re-bases elapsed ms while timer continues running', () => {
    const { timerUI, tasks } = createTimerUI()
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
    timerUI.toggle('task-1')
    vi.setSystemTime(new Date('2024-01-01T00:00:03.000Z'))

    timerUI.setBaseElapsedMs('task-1', 60000)
    vi.setSystemTime(new Date('2024-01-01T00:00:05.000Z'))
    timerUI.toggle('task-1')

    expect(tasks[0].elapsedMs).toBe(62000)
  })

  it('applies batched DOM updates with formatted time', () => {
    const { timerUI } = createTimerUI()
    document.body.innerHTML = '<div data-testid="task-task-1"><span class="timer-display">--:--</span></div>'

    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
    timerUI.toggle('task-1')
    vi.setSystemTime(new Date('2024-01-01T00:00:07.000Z'))

    ;(timerUI as unknown as { scheduleUpdate: (id: string) => void }).scheduleUpdate('task-1')
    vi.advanceTimersByTime(100)

    const display = document.querySelector('[data-testid="task-task-1"] .timer-display')
    expect(display?.textContent).toBe('00:00:07')

    timerUI.clearAll()
  })

  it('clears all running timers', () => {
    const { timerUI } = createTimerUI()
    timerUI.toggle('task-1')

    timerUI.clearAll()

    expect(timerUI.isRunning('task-1')).toBe(false)
  })
})
