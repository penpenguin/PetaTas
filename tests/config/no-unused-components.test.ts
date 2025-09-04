import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'

describe('No unused Astro components kept around', () => {
  it('TaskList.astro and TaskRow.astro should not exist', () => {
    const taskList = resolve(process.cwd(), 'src', 'components', 'TaskList.astro')
    const taskRow = resolve(process.cwd(), 'src', 'components', 'TaskRow.astro')
    expect(existsSync(taskList)).toBe(false)
    expect(existsSync(taskRow)).toBe(false)
  })
})

