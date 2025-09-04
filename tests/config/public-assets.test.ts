import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'

describe('Public assets hygiene', () => {
  it('does not include legacy task-list.css', () => {
    const legacyCss = resolve(process.cwd(), 'public', 'task-list.css')
    expect(existsSync(legacyCss)).toBe(false)
  })
})

