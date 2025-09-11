import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'

// Minimal Task shape used by storage mock
const task = {
  id: 'task_1',
  name: 'A',
  status: 'todo',
  notes: '',
  elapsedMs: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  additionalColumns: { Priority: 'High' }
}

describe('Export shows toast and closes menu', () => {
  let dom: JSDOM
  const mockChrome = {
    storage: { sync: { get: vi.fn(), set: vi.fn(), remove: vi.fn(), clear: vi.fn(), getBytesInUse: vi.fn().mockResolvedValue(0) } }
  }

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div class="navbar bg-base-200">
        <div class="flex-none gap-2">
          <div class="dropdown dropdown-end dropdown-open" id="actions-dropdown">
            <label tabindex="0" class="btn btn-ghost btn-sm" aria-label="Actions">⋯</label>
            <ul tabindex="0" class="menu menu-sm dropdown-content z-50 mt-2 p-2 shadow bg-base-200 rounded-box w-56">
              <li><button id="paste-button">Paste</button></li>
              <li><button id="add-task-button">Add</button></li>
              <li><button id="export-button" data-testid="export-button">Export</button></li>
              <li><button id="clear-all-button">Clear</button></li>
            </ul>
          </div>
        </div>
      </div>
      <div id="task-list" class="list hidden"></div>
      <div id="empty-state"></div>
      <div id="toast-container"></div>
      <input type="checkbox" id="add-task-modal" class="modal-toggle" />
      <div class="modal"><div class="modal-box"><form id="add-task-form"><div id="dynamic-fields-container"></div></form></div></div>
    </body></html>`, { url: 'chrome-extension://test/panel.html' })

    // @ts-expect-error test env
    global.window = dom.window as any
    // @ts-expect-error test env
    global.document = dom.window.document as any
    // @ts-expect-error test env
    global.chrome = mockChrome

    Object.defineProperty(global.navigator, 'clipboard', {
      value: { readText: vi.fn(), writeText: vi.fn() },
      writable: true
    })

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    dom.window.close()
  })

  it('success: shows success toast and closes dropdown', async () => {
    mockChrome.storage.sync.get.mockResolvedValue({ tasks: [task] })
    mockChrome.storage.sync.set.mockResolvedValue(undefined)
    ;(navigator.clipboard.writeText as any) = vi.fn().mockResolvedValue(undefined)

    vi.resetModules()
    await import('../../src/panel-client.ts')

    // Wait a tick for initialize → listeners
    await new Promise(r => setTimeout(r, 10))

    const dropdown = document.getElementById('actions-dropdown')!
    expect(dropdown.className).toMatch(/\bdropdown-open\b/)

    ;(document.getElementById('export-button') as HTMLButtonElement).click()

    // Allow async export
    await new Promise(r => setTimeout(r, 10))

    // Success toast appears
    const toast = document.querySelector('#toast-container .alert.alert-success') as HTMLElement | null
    expect(toast).toBeTruthy()

    // Dropdown is closed (class removed and focus cleared inside dropdown)
    expect(dropdown.className).not.toMatch(/\bdropdown-open\b/)
  })

  it('failure: shows error toast and closes dropdown', async () => {
    mockChrome.storage.sync.get.mockResolvedValue({ tasks: [task] })
    mockChrome.storage.sync.set.mockResolvedValue(undefined)
    ;(navigator.clipboard.writeText as any) = vi.fn().mockRejectedValue(new Error('boom'))

    vi.resetModules()
    await import('../../src/panel-client.ts')

    await new Promise(r => setTimeout(r, 10))

    const dropdown = document.getElementById('actions-dropdown')!
    expect(dropdown.className).toMatch(/\bdropdown-open\b/)

    ;(document.getElementById('export-button') as HTMLButtonElement).click()

    await new Promise(r => setTimeout(r, 10))

    // Error toast appears
    const toast = document.querySelector('#toast-container .alert.alert-error') as HTMLElement | null
    expect(toast).toBeTruthy()

    expect(dropdown.className).not.toMatch(/\bdropdown-open\b/)
  })
})

