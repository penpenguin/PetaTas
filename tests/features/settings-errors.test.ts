import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const loadTitleAliasesMock = vi.fn<[], Promise<string[]>>()
const saveTitleAliasesMock = vi.fn<[string[]], Promise<void>>()
const parseCsvAliasesMock = vi.fn<[string], string[]>()
const loadNormalizedTitleAliasesMock = vi.fn<[], Promise<Set<string>>>()

const handleGeneralErrorMock = vi.fn()
const handleClipboardErrorMock = vi.fn()
const handleStorageErrorMock = vi.fn()
const handleClipboardReadMock = vi.fn()
const showToastMock = vi.fn()

const storageLoadMock = vi.fn<[], Promise<any[]>>()
const storageSaveMock = vi.fn<[any[]], Promise<void>>()
const storageClearTimerStateMock = vi.fn<[string], Promise<void>>()
const storageClearTimerStatesMock = vi.fn<[], Promise<void>>()

class FakeTimerUI {
  isRunning = vi.fn().mockReturnValue(false)
  toggle = vi.fn()
  clearAll = vi.fn()
  setBaseElapsedMs = vi.fn()

  constructor(private readonly opts: unknown) {
    void this.opts
  }
}

vi.mock('@/utils/settings-manager', () => ({
  loadNormalizedTitleAliases: loadNormalizedTitleAliasesMock,
  loadTitleAliases: loadTitleAliasesMock,
  parseCsvAliases: parseCsvAliasesMock,
  saveTitleAliases: saveTitleAliasesMock,
}))

vi.mock('@/utils/error-handler', () => ({
  handleStorageError: handleStorageErrorMock,
  handleClipboardError: handleClipboardErrorMock,
  handleGeneralError: handleGeneralErrorMock,
  handleClipboardErrorForTests: handleClipboardReadMock,
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

vi.mock('@/utils/markdown-parser', () => ({
  parseMarkdownTable: vi.fn(),
}))

vi.mock('@/utils/time-utils', () => ({
  minutesToMs: (n: number) => n * 60000,
  formatHms: (ms: number) => `00:00:${String(Math.floor(ms / 1000)).padStart(2, '0')}`,
}))

vi.mock('@/utils/task-renderer', () => ({
  default: vi.fn(() => '<div data-testid="task-row"></div>'),
}))

vi.mock('@/utils/task-dom', () => ({
  applyRowVisualState: vi.fn(),
  updateRowFromTask: vi.fn(),
  setTimerButtonState: vi.fn(),
}))

vi.mock('@/utils/form-field-utils', () => ({
  getFieldLabel: (name: string) => name,
  getFieldPlaceholder: (name: string) => `Enter ${name}`,
}))

vi.mock('@/utils/form-state-utils', () => ({
  captureDynamicFieldState: vi.fn(() => ({ inputs: [] })),
  restoreDynamicFieldState: vi.fn(),
}))

vi.mock('@/types/task', () => ({
  createTask: vi.fn(() => ({
    id: 'generated',
    name: 'Generated Task',
    status: 'todo',
    notes: '',
    elapsedMs: 0,
    additionalColumns: {},
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  })),
  Task: class {},
}))

vi.mock('@/utils/system-columns', () => ({
  isSystemHeader: vi.fn(() => false),
}))

const flushAsync = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('PetaTasClient settings error handling', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    storageLoadMock.mockResolvedValue([])
    storageSaveMock.mockResolvedValue()
    storageClearTimerStateMock.mockResolvedValue()
    storageClearTimerStatesMock.mockResolvedValue()
    loadNormalizedTitleAliasesMock.mockResolvedValue(new Set())
    loadTitleAliasesMock.mockResolvedValue([])
    parseCsvAliasesMock.mockImplementation((raw: string) => raw.split(',').map(s => s.trim()).filter(Boolean))
    saveTitleAliasesMock.mockResolvedValue()

    document.body.innerHTML = `
      <button id="settings-button">settings</button>
      <form id="settings-form">
        <textarea id="title-aliases-input"></textarea>
      </form>
      <input id="settings-modal" type="checkbox" />
      <div id="task-list"></div>
      <div id="empty-state"></div>
    `

    ;(globalThis as any).chrome = { storage: { sync: {} } }
    ;(globalThis as any).confirm = vi.fn(() => true)
  })

  afterEach(() => {
    delete (globalThis as any).chrome
    delete (globalThis as any).confirm
  })

  it('reports a load error when opening settings fails', async () => {
    loadTitleAliasesMock.mockRejectedValueOnce(new Error('load failed'))

    await import('@/panel-client')
    await flushAsync()

    document.getElementById('settings-button')?.dispatchEvent(new Event('click'))

    await flushAsync()

    expect(handleGeneralErrorMock).toHaveBeenCalledWith(expect.any(Error), 'medium', { module: 'PetaTasClient', operation: 'openSettings' })
  })

  it('shows toast and logs when saving settings fails', async () => {
    saveTitleAliasesMock.mockRejectedValueOnce(new Error('persist failed'))

    await import('@/panel-client')
    await flushAsync()

    const textarea = document.getElementById('title-aliases-input') as HTMLTextAreaElement
    textarea.value = 'alias1'

    const form = document.getElementById('settings-form') as HTMLFormElement
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await flushAsync()

    expect(saveTitleAliasesMock).toHaveBeenCalledWith(['alias1'])

    expect(handleGeneralErrorMock).toHaveBeenCalledWith(expect.any(Error), 'high', { module: 'PetaTasClient', operation: 'saveSettings' })
    expect(showToastMock).toHaveBeenCalledWith('Failed to save settings.', 'error')
  })
})
