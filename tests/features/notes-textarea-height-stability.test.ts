import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Notes textarea height remains stable on timer ops', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="task-list" class="list hidden"></div>
      <div id="empty-state"></div>
      <div id="toast-container"></div>
    </body></html>`)

    // @ts-expect-error test env
    global.window = dom.window as any
    // @ts-expect-error test env
    global.document = dom.window.document as any

    const mql = {
      matches: false,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as unknown as MediaQueryList
    // @ts-expect-error stub
    window.matchMedia = vi.fn().mockReturnValue(mql)

    const tasks = [
      { id: 't1', name: 'Test', status: 'todo', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: {} }
    ]
    const mockChrome = {
      storage: {
        sync: {
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
          set: vi.fn().mockResolvedValue(undefined)
        }
      }
    }
    // @ts-expect-error test env
    global.chrome = mockChrome
  })

  afterEach(() => {
    vi.restoreAllMocks()
    dom.window.close()
  })

  it('keeps rows=1 and class list unchanged across timer start/stop', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))

    const textarea = document.querySelector('textarea.notes-input') as HTMLTextAreaElement
    expect(textarea).toBeTruthy()
    expect(textarea.getAttribute('rows')).toBe('1')
    expect(textarea.className).toMatch(/\btextarea\b/)
    expect(textarea.className).toMatch(/\btextarea-bordered\b/)
    expect(textarea.className).not.toMatch(/\bhidden\b/)
    // Ensure no DaisyUI min-height forces multi-line height
    expect(textarea.className).toMatch(/\bmin-h-0\b/)
    const initialClass = textarea.className

    const timerBtn = document.querySelector('button[data-action="timer"]') as HTMLButtonElement
    expect(timerBtn).toBeTruthy()

    // Start timer
    timerBtn.click()
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    const afterStart = document.querySelector('textarea.notes-input') as HTMLTextAreaElement
    expect(afterStart.getAttribute('rows')).toBe('1')
    expect(afterStart.className).toBe(initialClass)

    // Stop timer
    timerBtn.click()
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    const afterStop = document.querySelector('textarea.notes-input') as HTMLTextAreaElement
    expect(afterStop.getAttribute('rows')).toBe('1')
    expect(afterStop.className).toBe(initialClass)
  })
})
