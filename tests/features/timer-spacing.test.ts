import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Timer spacing next to status badge', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="task-list" class="list hidden"></div>
      <div id="empty-state"></div>
      <div id="toast-container"></div>
    </body></html>`, { url: 'chrome-extension://test/panel.html' })

    // @ts-expect-error test env
    ;(global as any).window = dom.window as any
    // @ts-expect-error test env
    ;(global as any).document = dom.window.document as any

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
    ;(global as any).chrome = mockChrome
  })

  afterEach(() => {
    vi.restoreAllMocks()
    dom.window.close()
  })

  it('uses reduced left margin (ml-2) and not ml-4', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')

    const timer = document.querySelector('.timer-controls') as HTMLElement
    expect(timer).toBeTruthy()
    expect(timer.className).toMatch(/\bml-2\b/)
    expect(timer.className).not.toMatch(/\bml-4\b/)
  })
})

