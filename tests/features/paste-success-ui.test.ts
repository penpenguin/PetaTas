import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'

const mockChrome = {
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      getBytesInUse: vi.fn().mockResolvedValue(0),
    },
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
  },
}

describe('Paste success shows toast and closes menu', () => {
  beforeEach(() => {
    const dom = new JSDOM(`
      <html>
        <body>
          <div class=\"navbar bg-base-200\">
            <div class=\"dropdown dropdown-end dropdown-open\" id=\"actions-dropdown\">
              <label tabindex=\"0\" class=\"btn btn-ghost btn-sm\" aria-label=\"Actions\"></label>
              <ul tabindex=\"0\" class=\"menu menu-sm dropdown-content z-50 mt-2 p-2 shadow bg-base-200 rounded-box w-56\">
                <li>
                  <button id=\"paste-button\" data-testid=\"paste-button\">Paste Markdown</button>
                </li>
                <li>
                  <button id=\"export-button\" data-testid=\"export-button\">Export</button>
                </li>
              </ul>
            </div>
          </div>

          <div id=\"task-list\" class=\"list hidden\"></div>
          <div id=\"empty-state\" data-testid=\"empty-state\"></div>
          <div id=\"toast-container\"></div>

          <!-- Add Task / Settings placeholders required by event wiring -->
          <input type=\"checkbox\" id=\"add-task-modal\" class=\"modal-toggle\" />
          <div class=\"modal\"><div class=\"modal-box\"><form id=\"add-task-form\"><div id=\"dynamic-fields-container\"></div></form></div></div>
          <input type=\"checkbox\" id=\"settings-modal\" class=\"modal-toggle\" />
          <form id=\"settings-form\"></form>
        </body>
      </html>
    `)

    ;(global as any).document = dom.window.document as unknown as Document
    ;(global as any).window = dom.window as any
    ;(global as any).chrome = mockChrome as any

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows success toast and removes dropdown-open on successful paste', async () => {
    // chrome.storage.sync mocks → no existing tasks, empty index
    mockChrome.storage.sync.get.mockImplementation(async (keys: any) => {
      const index = { version: 1, chunks: [], total: 0, updatedAt: 0 }
      if (keys === 'tasks_index') return { tasks_index: index }
      if (Array.isArray(keys)) return {}
      if (keys === null) return {}
      return {}
    })
    mockChrome.storage.sync.set.mockResolvedValue(undefined)

    // clipboard mock with simple table (2 rows)
    const md = [
      '| 名前 | 見積(分) |',
      '| --- | --- |',
      '| タスク1 | 10 |',
      '| タスク2 | 20 |',
    ].join('\n')
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { readText: vi.fn().mockResolvedValue(md), writeText: vi.fn() },
      writable: true,
    })

    vi.resetModules()
    await import('../../src/panel-client.ts')

    // Sanity: dropdown is open before
    const dropdown = document.getElementById('actions-dropdown')!
    expect(dropdown.className).toContain('dropdown-open')

    ;(document.getElementById('paste-button') as HTMLButtonElement).click()

    // Allow async/microtasks to run; toast + menu close happen before storage save resolves
    await new Promise((r) => setTimeout(r, 60))

    // Toast appeared with success style and message contains Imported + count
    const toastContainer = document.getElementById('toast-container')!
    const alerts = Array.from(toastContainer.querySelectorAll('.alert.alert-success')) as HTMLElement[]
    const text = alerts.map(a => a.textContent || '').join(' ')
    expect(alerts.length).toBeGreaterThanOrEqual(1)
    expect(text).toMatch(/Imported/i)
    expect(text).toMatch(/2/) // two rows imported

    // Menu closed
    expect(dropdown.className).not.toContain('dropdown-open')
  })
})

