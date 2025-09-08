import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Header layout at 360px uses nowrap and ellipsis', () => {
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
            { id: 'x', name: 'X', status: 'in-progress', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: {} }
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

  it('renders header with whitespace-nowrap and a truncating status badge', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')

    const row = document.querySelector('.list-row') as HTMLElement
    expect(row).toBeTruthy()

    const header = row.querySelector('div.flex.items-center') as HTMLElement
    expect(header).toBeTruthy()
    expect(header.className).toMatch(/\bwhitespace-nowrap\b/)

    const badge = row.querySelector('.status-badge') as HTMLElement
    expect(badge).toBeTruthy()
    expect(badge.className).toMatch(/w-\[5rem\]/)
    // Outer uses overflow-hidden, inner uses truncate
    expect(badge.className).toMatch(/\boverflow-hidden\b/)

    const inner = badge.querySelector('span') as HTMLElement
    expect(inner).toBeTruthy()
    expect(inner.className).toMatch(/\btruncate\b/)
  })
})
