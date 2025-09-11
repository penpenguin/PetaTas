import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Manifest permissions for clipboard operations', () => {
  const manifestPath = resolve(process.cwd(), 'public', 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  it('requests clipboardRead permission for reliable paste', () => {
    const perms: string[] = manifest.permissions || []
    expect(perms.includes('clipboardRead')).toBe(true)
  })

  it('does not expose web_accessible_resources to <all_urls>', () => {
    const war = manifest.web_accessible_resources || []
    const anyAllUrls = war.some((entry: any) => Array.isArray(entry?.matches) && entry.matches.includes('<all_urls>'))
    expect(anyAllUrls).toBe(false)
  })
})
