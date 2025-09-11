import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('panel-client uses shared form utils', () => {
  const file = resolve(process.cwd(), 'src', 'panel-client.ts')
  const content = readFileSync(file, 'utf8')

  it('imports getFieldLabel/getFieldPlaceholder from utils', () => {
    expect(content).toMatch(/from\s+['\"]@\/utils\/form-field-utils['\"]/)
    // Should not define local functions with these names
    expect(content).not.toMatch(/function\s+getFieldLabel\s*\(/)
    expect(content).not.toMatch(/function\s+getFieldPlaceholder\s*\(/)
  })

  it('imports capture/restore form-state utils instead of local functions', () => {
    expect(content).toMatch(/from\s+['\"]@\/utils\/form-state-utils['\"]/)
    expect(content).not.toMatch(/function\s+captureFormState\s*\(/)
    expect(content).not.toMatch(/function\s+restoreFormState\s*\(/)
  })
})

