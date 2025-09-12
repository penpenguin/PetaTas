import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'

describe('daisyUI conformance in rendered task rows', () => {
  let dom: JSDOM
  let mockChrome: any

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="task-list" class="list hidden"></div>
      <div id="empty-state"></div>
      <div id="toast-container"></div>
    </body></html>`, { url: 'chrome-extension://test/panel.html' })

    // @ts-expect-error test env
    global.window = dom.window as any
    // @ts-expect-error test env
    global.document = dom.window.document as any

    const tasks = [
      {
        id: 't1',
        name: 'A task',
        status: 'todo',
        notes: 'Some note',
        elapsedMs: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        additionalColumns: { Priority: 'High' }
      }
    ]
    mockChrome = {
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
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn(),
          clear: vi.fn(),
          getBytesInUse: vi.fn().mockResolvedValue(0)
        }
      }
    }
    // @ts-expect-error test env
    global.chrome = mockChrome

    // Clipboard stub
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { readText: vi.fn(), writeText: vi.fn() },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    dom.window.close()
  })

  it('renders list rows using daisyUI card styles and badges', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')

    const row = document.querySelector('.list-row') as HTMLElement
    expect(row).toBeTruthy()
    expect(row.className).toMatch(/\bcard\b/)
    expect(row.className).toMatch(/\bcard-compact\b/)
    expect(row.className).toMatch(/\bshadow/) // allow any shadow size

    const cardBody = row.querySelector('.card-body') as HTMLElement
    expect(cardBody).toBeTruthy()

    const badge = row.querySelector('.badge') as HTMLElement
    expect(badge).toBeTruthy()
    expect(badge.className).toMatch(/\bbadge\b/)
    expect(badge.className).toMatch(/\bbadge-md\b/)

    // Notes textarea is the primary editor (no separate display block)
    const notesArea = row.querySelector('textarea.notes-input') as HTMLElement
    expect(notesArea).toBeTruthy()

    const del = row.querySelector('button[data-action="delete"]') as HTMLElement
    expect(del).toBeTruthy()
    expect(del.className).toMatch(/\bbtn\b/)
    expect(del.className).toMatch(/\bbtn-ghost\b/)
    expect(del.className).toMatch(/text-base-content\/60/)
    expect(del.className).toMatch(/hover:bg-error\/10/)

    // Checkbox should use default daisyUI style (no color variant)
    const checkbox = row.querySelector('.checkbox') as HTMLElement
    expect(checkbox).toBeTruthy()
    expect(checkbox.className).not.toMatch(/checkbox-primary/)

    // Textarea should use daisyUI defaults (simple, bordered)
    const textarea = row.querySelector('textarea.notes-input') as HTMLTextAreaElement
    expect(textarea).toBeTruthy()
    expect(textarea.className).toMatch(/\btextarea\b/)
    expect(textarea.className).toMatch(/\btextarea-bordered\b/)
    expect(textarea.className).not.toMatch(/resize-none|bg-transparent|border-gray|rounded\[|outline-none|text-sm|textarea-sm|px-2|py-1/)

    // Timer button shows an SVG icon (not emoji text)
    const timerBtn = row.querySelector('button[data-action="timer"]') as HTMLElement
    expect(timerBtn).toBeTruthy()
    const timerIcon = timerBtn.querySelector('svg')
    expect(timerIcon).toBeTruthy()
  })
})
