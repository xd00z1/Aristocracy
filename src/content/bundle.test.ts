/**
 * The client graph must not pull the validator's dependency in.
 *
 * Zod builds its schema objects at module scope and its constructors are not
 * marked pure, so a single value import of src/content/schema.ts anywhere in
 * the app drags the whole library (about 87 KB gzipped) into the first chunk
 * every reader downloads — for constants that are plain arrays and regexes.
 * Those live in src/content/constants.ts; this test keeps them there.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '..')

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full))
      continue
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue
    out.push(full)
  }
  return out
}

/**
 * True when the file has an import that is not `import type` — one that
 * survives to runtime — from a path ending in `module`. The lazy body stops at
 * the first `from`, so one import statement is never read across another.
 */
function valueImportsOf(source: string, module: string): boolean {
  const pattern = new RegExp(String.raw`^import\s+(?!type\b)(?:(?!\bfrom\b)[\s\S])*?\bfrom\s+'[^']*${module}'`, 'm')
  return pattern.test(source)
}

describe('the client content graph', () => {
  const files = sourceFiles(SRC)

  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('imports zod only in the schema itself', () => {
    const offenders = files.filter((f) => valueImportsOf(readFileSync(f, 'utf8'), 'zod')).map((f) => path.relative(SRC, f))
    expect(offenders).toEqual(['content/schema.ts'])
  })

  it('takes constants from content/constants, never as values from content/schema', () => {
    const offenders = files
      .filter((f) => path.relative(SRC, f) !== 'content/schema.ts')
      .filter((f) => valueImportsOf(readFileSync(f, 'utf8'), 'content/schema'))
      .map((f) => path.relative(SRC, f))
    expect(offenders).toEqual([])
  })
})
