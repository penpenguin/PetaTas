import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const parseMarkdownTableMock = vi.fn()
const loadNormalizedTitleAliasesMock = vi.fn<[], Promise<Set<string>>>()
const loadTitleAliasesMock = vi.fn<[], Promise<string[]>>()
const parseCsvAliasesMock = vi.fn<[string], string[]>()
const saveTitleAliasesMock = vi.fn<[string[]], Promise<void>>()

const handleClipboardErrorMock = vi.fn()
const handleGeneralErrorMock = vi.fn()
const handleStorageErrorMock = vi.fn()
const showToastMock = vi.fn()

const storageLoadMock = vi.fn<[], Promise<any[]>>()
const storageSaveMock = vi.fn<[any[]], Promise<void>>()
const storageClearTimerStateMock = vi.fn<[string], Promise<void>>()
const storageClearTimerStatesMock = vi.fn<[], Promise<void>>()

class FakeTimerUI {
  static instances: FakeTimerUI[] = []

  readonly isRunning = vi.fn().mockReturnValue(false)
  readonly toggle = vi.fn()
  readonly clearAll = vi.fn()
  readonly setBaseElapsedMs = vi.fn()

  constructor(private readonly opts: unknown) {
    FakeTimerUI.instances.push(this)
    void this.opts
  }

  static reset(): void {
    FakeTimerUI.instances.length = 0
  }
}

vi.mock('@/utils/markdown-parser', () => ({
  parseMarkdownTable: parseMarkdownTableMock,
}))

vi.mock('@/utils/settings-manager', () => ({
  loadNormalizedTitleAliases: loadNormalizedTitleAliasesMock,
  loadTitleAliases: loadTitleAliasesMock,
  parseCsvAliases: parseCsvAliasesMock,
  saveTitleAliases: saveTitleAliasesMock,
}))

vi.mock('@/utils/error-handler', () => ({
  handleClipboardError: handleClipboardErrorMock,
  handleGeneralError: handleGeneralErrorMock,
  handleStorageError: handleStorageErrorMock,
}))

vi.mock('@/utils/storage-manager', () => ({
  StorageManager: class {
    loadTasks = storageLoadMock
    saveTasks = storageSaveMock
    clearTimerState = storageClearTimerStateMock
    clearTimerStates = storageClearTimerStatesMock
  }
}))

vi.mock('@/utils/timer-ui', () => ({
  default: FakeTimerUI,
}))

vi.mock('@/utils/theme', () => ({
  initSystemThemeSync: vi.fn(),
}))

vi.mock('@/utils/toast', () => ({
  default: showToastMock,
}))

vi.mock('@/utils/time-utils', () => ({
  minutesToMs: (minutes: number) => minutes * 60 * 1000,
  formatHms: (ms: number) => `00:00:${String(Math.floor(ms / 1000)).padStart(2, '0')}`,
}))

vi.mock('@/utils/task-renderer', () => ({
  default: vi.fn(() => '<li data-testid="task-row"></li>'),
}))

vi.mock('@/utils/task-dom', () => ({
  applyRowVisualState: vi.fn(),
  updateRowFromTask: vi.fn(),
  setTimerButtonState: vi.fn(),
}))

vi.mock('@/types/task', () => ({
  createTask: vi.fn(() => ({
    id: 'generated-task',
    name: 'Generated',
    status: 'todo',
    notes: '',
    elapsedMs: 0,
    additionalColumns: {},
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
  })),
}))

vi.mock('@/utils/system-columns', () => ({
  isSystemHeader: vi.fn(() => false),
}))

const flushAsync = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

const originalNavigator = globalThis.navigator

describe('PetaTasClient paste & clear flows', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    FakeTimerUI.reset()

    const clipboard = {
      readText: vi.fn(),
      writeText: vi.fn(),
    }

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { clipboard },
    })

    ;(globalThis as any).chrome = { storage: { sync: {} } }

    document.body.innerHTML = `
      <button id="paste-button"></button>
      <button id="export-button"></button>
      <div class="dropdown"></div>
      <button id="add-task-button"></button>
      <button id="clear-all-button"></button>
      <button id="settings-button"></button>
      <form id="settings-form"></form>
      <input id="settings-modal" type="checkbox" />
      <form id="add-task-form"></form>
      <div id="dynamic-fields-container"></div>
      <div id="task-list"></div>
      <div id="empty-state"></div>
    `

    storageSaveMock.mockResolvedValue(undefined)
    storageClearTimerStateMock.mockResolvedValue(undefined)
    storageClearTimerStatesMock.mockResolvedValue(undefined)
    loadNormalizedTitleAliasesMock.mockResolvedValue(new Set())
    loadTitleAliasesMock.mockResolvedValue([])
    parseCsvAliasesMock.mockImplementation((raw: string) => raw.split(',').map(s => s.trim()).filter(Boolean))
    saveTitleAliasesMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    })
    delete (globalThis as any).chrome
    delete (globalThis as any).confirm
  })

  it('aborts paste when user cancels confirmation', async () => {
    storageLoadMock.mockResolvedValue([
      {
        id: 'existing',
        name: 'Existing',
        status: 'todo',
        notes: '',
        elapsedMs: 0,
        additionalColumns: {},
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      }
    ])

    parseMarkdownTableMock.mockReturnValue({
      headers: ['Task'],
      rows: [['Task from clipboard']],
    })

    const clipboard = globalThis.navigator.clipboard as { readText: ReturnType<typeof vi.fn> }
    clipboard.readText.mockResolvedValue('| Task |\n| --- |\n| Task from clipboard |')

    ;(globalThis as any).confirm = vi.fn(() => false)

    await import('@/panel-client')
    await flushAsync()

    document.getElementById('paste-button')?.dispatchEvent(new Event('click'))
    await flushAsync()

    expect(globalThis.navigator.clipboard.readText).toHaveBeenCalled()
    expect(parseMarkdownTableMock).toHaveBeenCalled()
    expect(globalThis.confirm).toHaveBeenCalledTimes(1)
    expect(loadNormalizedTitleAliasesMock).not.toHaveBeenCalled()
    expect(FakeTimerUI.instances[0]?.clearAll).not.toHaveBeenCalled()
    expect(showToastMock).not.toHaveBeenCalledWith(expect.stringContaining('Imported'), 'success')
    expect(handleClipboardErrorMock).not.toHaveBeenCalled()
  })

  it('reports clipboard read failures', async () => {
    storageLoadMock.mockResolvedValue([])

    const clipboard = globalThis.navigator.clipboard as { readText: ReturnType<typeof vi.fn> }
    clipboard.readText.mockRejectedValue(new Error('denied'))

    await import('@/panel-client')
    await flushAsync()

    document.getElementById('paste-button')?.dispatchEvent(new Event('click'))
    await flushAsync()

    expect(handleClipboardErrorMock).toHaveBeenCalledWith(expect.any(Error), { module: 'PetaTasClient', operation: 'handlePasteClick' }, 'read')
  })

  it('handles errors when clearing all tasks fails', async () => {
    storageLoadMock.mockResolvedValue([
      {
        id: 'existing',
        name: 'Existing',
        status: 'todo',
        notes: '',
        elapsedMs: 0,
        additionalColumns: {},
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      }
    ])

    storageClearTimerStatesMock.mockRejectedValueOnce(new Error('clear failed'))

    ;(globalThis as any).confirm = vi.fn(() => true)

    await import('@/panel-client')
    await flushAsync()

    document.getElementById('clear-all-button')?.dispatchEvent(new Event('click'))
    await flushAsync()
    await new Promise(resolve => setTimeout(resolve, 0))
    await flushAsync()

    expect(FakeTimerUI.instances[0]?.clearAll).toHaveBeenCalled()
    expect(storageClearTimerStatesMock).toHaveBeenCalled()
    expect(storageSaveMock).toHaveBeenCalled()
    expect(handleGeneralErrorMock).toHaveBeenCalledWith(expect.any(Error), 'high', { module: 'PetaTasClient', operation: 'clearAllTasks' })
  })
  it('clears all tasks when confirm is unavailable', async () => {
    storageLoadMock.mockResolvedValue([
      {
        id: 'existing',
        name: 'Existing',
        status: 'todo',
        notes: '',
        elapsedMs: 0,
        additionalColumns: {},
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      }
    ])

    Object.defineProperty(globalThis, 'confirm', { configurable: true, value: undefined })

    await import('@/panel-client')
    await flushAsync()

    const clearButton = document.getElementById('clear-all-button')
    clearButton?.dispatchEvent(new Event('click'))

    await flushAsync()
    await flushAsync()

    const timerInstance = FakeTimerUI.instances[0]
    expect(timerInstance?.clearAll).toHaveBeenCalled()
    expect(storageClearTimerStatesMock).toHaveBeenCalledTimes(1)
    expect(storageSaveMock).toHaveBeenCalledTimes(1)
  })

  it('stops running timer and logs when storage cleanup fails during deletion', async () => {
    storageLoadMock.mockResolvedValue([
      {
        id: 'task-1',
        name: 'Del Target',
        status: 'todo',
        notes: '',
        elapsedMs: 120000,
        additionalColumns: {},
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      }
    ])

    storageClearTimerStateMock.mockRejectedValue(new Error('Storage error'))

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await import('@/panel-client')
    await flushAsync()

    const timerInstance = FakeTimerUI.instances[0]
    timerInstance?.isRunning.mockReturnValue(true)

    const list = document.getElementById('task-list')
    list!.innerHTML = '<button data-action="delete" data-task-id="task-1"></button>'

    const deleteBtn = list?.querySelector('[data-action="delete"]') as HTMLButtonElement | null
    deleteBtn?.dispatchEvent(new Event('click', { bubbles: true }))

    await flushAsync()
    await flushAsync()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(timerInstance?.toggle).toHaveBeenCalledWith('task-1')
    expect(storageSaveMock).toHaveBeenCalled()
    expect(storageClearTimerStateMock).toHaveBeenCalledWith('task-1')
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to clean up task data:', expect.any(Error))

    consoleErrorSpy.mockRestore()
  })

})
