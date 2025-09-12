import type { Task } from '@/types/task'
import { formatHms } from '@/utils/time-utils'

export interface UITimer {
  startTime: number
  interval: NodeJS.Timeout
}

export interface TimerUIOptions {
  getTasks: () => Task[]
  saveTasks: () => Promise<void>
  updateTaskRowVisualState: (taskId: string, status: string) => void
  updateTimerButtonState: (taskId: string, isRunning: boolean) => void
}

// UI-oriented timer controller: owns intervals + batched DOM updates.
export default class TimerUI {
  private activeTimers = new Map<string, UITimer>()
  private timerUpdateBatch: Set<string> = new Set()
  private batchUpdateTimer: NodeJS.Timeout | null = null

  constructor(private readonly opts: TimerUIOptions) {}

  isRunning(taskId: string): boolean {
    return this.activeTimers.has(taskId)
  }

  clearAll(): void {
    this.activeTimers.forEach((t) => clearInterval(t.interval))
    this.activeTimers.clear()
  }

  setBaseElapsedMs(taskId: string, newElapsedMs: number): void {
    const timer = this.activeTimers.get(taskId)
    if (!timer) return
    const task = this.opts.getTasks().find(t => t.id === taskId)
    if (!task) return
    task.elapsedMs = newElapsedMs
    timer.startTime = Date.now()
  }

  toggle(taskId: string): void {
    const tasks = this.opts.getTasks()
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    if (task.status === 'done' && !this.activeTimers.has(taskId)) {
      this.opts.updateTimerButtonState(taskId, false)
      return
    }

    if (this.activeTimers.has(taskId)) {
      const timer = this.activeTimers.get(taskId)!
      clearInterval(timer.interval)

      task.elapsedMs += Date.now() - timer.startTime
      task.status = task.status === 'done' ? 'done' : 'todo'
      task.updatedAt = new Date()

      this.opts.updateTaskRowVisualState(taskId, task.status)
      this.opts.updateTimerButtonState(taskId, false)

      this.opts.saveTasks().catch((e) => console.error('Failed to save timer state:', e))
      this.activeTimers.delete(taskId)
    } else {
      const timer: UITimer = {
        startTime: Date.now(),
        interval: setInterval(() => this.scheduleUpdate(taskId), 1000)
      }
      task.status = 'in-progress'
      task.updatedAt = new Date()
      this.opts.updateTaskRowVisualState(taskId, 'in-progress')
      this.opts.updateTimerButtonState(taskId, true)
      this.opts.saveTasks().catch((e) => console.error('Failed to save timer state:', e))
      this.activeTimers.set(taskId, timer)
    }
  }

  private scheduleUpdate(taskId: string): void {
    this.timerUpdateBatch.add(taskId)
    if (!this.batchUpdateTimer) {
      this.batchUpdateTimer = setTimeout(() => {
        this.processBatchedUpdates()
        this.batchUpdateTimer = null
      }, 100)
    }
  }

  private processBatchedUpdates(): void {
    const tasks = this.opts.getTasks()
    const updates: Array<{ el: Element; content: string }> = []

    this.timerUpdateBatch.forEach((taskId) => {
      const timer = this.activeTimers.get(taskId)
      const task = tasks.find(t => t.id === taskId)
      if (!timer || !task) return
      const current = task.elapsedMs + (Date.now() - timer.startTime)
      const display = document.querySelector(`[data-testid="task-${taskId}"] .timer-display`)
      if (display) updates.push({ el: display, content: formatHms(current) })
    })

    updates.forEach(({ el, content }) => { el.textContent = content })
    this.timerUpdateBatch.clear()
  }
}

