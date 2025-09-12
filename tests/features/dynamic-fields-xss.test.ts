import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'

// This test ensures that dynamic field creation does not inject HTML when
// headers (derived from user Markdown) contain malicious strings.
describe('Dynamic fields XSS hardening', () => {
  let dom: JSDOM

  const MALICIOUS_HEADER = String('title"><img src=x onerror="window.__xss__=1">')

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="task-list" class="list hidden"></div>
      <div id="empty-state"></div>
      <div id="toast-container"></div>
      <button id="paste-button"></button>
      <button id="export-button"></button>
      <button id="add-task-button"></button>
      <button id="clear-all-button"></button>
      <input type="checkbox" id="add-task-modal" class="modal-toggle" />
      <div class="modal"><div class="modal-box"><form id="add-task-form"><div id="dynamic-fields-container"></div></form></div></div>
    </body></html>`, { url: 'chrome-extension://test/panel.html' })

    // @ts-expect-error test env
    global.window = dom.window as any
    // @ts-expect-error test env
    global.document = dom.window.document as any

    // Prepare a stored task with a malicious additional column header
    const now = new Date().toISOString()
    const tasks = [{
      id: 'task_1', name: 'Sample', status: 'todo', notes: '', elapsedMs: 0,
      createdAt: now, updatedAt: now,
      additionalColumns: { [MALICIOUS_HEADER]: 'v' }
    }]

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
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn(),
          clear: vi.fn(),
          getBytesInUse: vi.fn().mockResolvedValue(0),
        },
      },
    }
    // @ts-expect-error test env
    global.chrome = mockChrome

    Object.defineProperty(global.navigator, 'clipboard', {
      value: { readText: vi.fn(), writeText: vi.fn() },
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    dom.window.close()
  })

  it('does not inject elements or attributes via malicious header', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')

    // Trigger UI to populate dynamic fields
    const btn = document.getElementById('add-task-button')!
    btn.click()

    const container = document.getElementById('dynamic-fields-container')!

    // Should create fields for "name" and the malicious header without injecting HTML
    const injected = container.querySelector('img, script')
    expect(injected).toBeNull()

    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>('input.dynamic-field-input'))
    // Find the input corresponding to the malicious header
    const maliciousInput = inputs.find(i => i.dataset.fieldName === MALICIOUS_HEADER)
    expect(maliciousInput).toBeTruthy()

    // Label should render literal text, not HTML
    const labels = Array.from(container.querySelectorAll<HTMLSpanElement>('label .label-text'))
    const lastLabel = labels[labels.length - 1]
    expect(lastLabel.textContent || '').toContain('Title')
    expect(lastLabel.textContent || '').toContain('<img')

    // Placeholder should include the literal header text
    const ph = maliciousInput!.getAttribute('placeholder') || ''
    expect(ph).toContain('Enter')
    expect(ph).toContain('<img')
  })
})
