import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Card width layout', () => {
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

    const mockChrome = {
      storage: {
        sync: {
          get: vi.fn().mockResolvedValue({ tasks: [
            { id: 'x', name: 'X', status: 'todo', notes: '', elapsedMs: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), additionalColumns: {} }
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

  it('renders list row and card body with w-full to avoid narrow children', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))

    const row = document.querySelector('.list-row') as HTMLElement
    expect(row).toBeTruthy()
    expect(row.className).toMatch(/\bw-full\b/)

    const body = row.querySelector('.card-body') as HTMLElement
    expect(body).toBeTruthy()
    expect(body.className).toMatch(/\bw-full\b/)

    // Header row should also stretch full width
    const header = body.querySelector('div.flex.items-center') as HTMLElement
    expect(header).toBeTruthy()
    expect(header.className).toMatch(/\bw-full\b/)
  })
})

