import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JSDOM } from 'jsdom'
import { getFieldLabel, getFieldPlaceholder } from '@/utils/form-field-utils'

describe('Add Task modal uses shared form utils for labels/placeholders', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div id="task-list" class="list hidden"></div>
      <div id="empty-state"></div>
      <div id="toast-container"></div>
      <button id="add-task-button">Add Task</button>
      <input type="checkbox" id="add-task-modal" class="modal-toggle" />
      <div class="modal">
        <div class="modal-box">
          <form id="add-task-form">
            <div id="dynamic-fields-container"></div>
            <button type="submit" id="submit-btn">Add Task</button>
          </form>
        </div>
      </div>
    </body></html>`, { url: 'chrome-extension://test/panel.html' })

    // @ts-expect-error test env
    global.window = dom.window as any
    // @ts-expect-error test env
    global.document = dom.window.document as any

    const mockChrome = {
      storage: { sync: { get: vi.fn().mockResolvedValue({ tasks: [] }), set: vi.fn().mockResolvedValue(undefined) } },
    }
    // @ts-expect-error test env
    global.chrome = mockChrome

    Object.defineProperty(global.navigator, 'clipboard', { value: { readText: vi.fn(), writeText: vi.fn() }, writable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    dom.window.close()
  })

  it('renders name field with label/placeholder from utils', async () => {
    vi.resetModules()
    await import('../../src/panel-client.ts')

    ;(document.getElementById('add-task-button') as HTMLButtonElement).click()
    const container = document.getElementById('dynamic-fields-container')!
    const labelText = container.querySelector('.label-text')?.textContent?.trim()
    const input = container.querySelector('.dynamic-field-input') as HTMLInputElement

    expect(labelText).toBe(getFieldLabel('name'))
    expect(input?.placeholder).toBe(getFieldPlaceholder('name'))
  })
})

