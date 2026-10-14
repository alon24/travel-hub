// Lists every English text passed to t('…') in src/, so src/i18n/he.ts can be checked against it.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export function sourceKeys(dir = 'src') {
  const keys = new Set()
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.tsx?$/.test(f) && !/\.test\.|[\\/]i18n[\\/]/.test(p)) {
        const src = readFileSync(p, 'utf8')
        for (const m of src.matchAll(/\bt\(\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g)) keys.add(Function(`return ${m[1]}`)())
      }
    }
  }
  walk(dir)
  return [...keys].sort()
}

if (process.argv[1]?.endsWith('i18n-keys.mjs')) console.log(JSON.stringify(sourceKeys(), null, 1))
