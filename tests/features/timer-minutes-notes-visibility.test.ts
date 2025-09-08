import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Timer minutes input should not show unrelated elements', () => {
  let dom: JSDOM

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

    const mockChrome = {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ tasks: [
            { id: 't1', name: 'A', status: 'todo', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: {} }
          ] }),
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

  it('does not create notes-display after changing minutes', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))

    const row = document.querySelector('.list-row') as HTMLElement
    expect(row).toBeTruthy()

    const initialNotesDisplay = row.querySelector('.notes-display') as HTMLElement | null
    expect(initialNotesDisplay).toBeNull()

    const input = row.querySelector('.timer-minutes-input') as HTMLInputElement
    expect(input).toBeTruthy()
    input.value = '5'
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }))

    // Allow async save to settle
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))

    // Should remain absent; no unexpected UI shown
    const afterNotesDisplay = row.querySelector('.notes-display') as HTMLElement | null
    expect(afterNotesDisplay).toBeNull()
  })
})
