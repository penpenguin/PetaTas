import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('CSP manifest hardening', () => {
  it("removes style-src 'unsafe-inline' from extension_pages", () => {
    const manifestPath = join(process.cwd(), 'public', 'manifest.json')
    const json = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const csp: string | undefined = json?.content_security_policy?.extension_pages
    expect(typeof csp).toBe('string')
    // Verify stricter CSP: no 'unsafe-inline' in style-src
    expect(csp).not.toMatch(/style-src[^;]*'unsafe-inline'/)
  })
})

