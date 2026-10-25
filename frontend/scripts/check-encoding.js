// Quick check for mojibake patterns in source files.
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const TARGETS = ['components', 'app', 'lib']
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.md'])
const PATTERNS = ['\u00e2\u20ac', '\u00c3', '\ufffd', '\u00e2\u20ac\u201c', '\u00e2\u20ac\u201d']

let bad = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (EXT.has(path.extname(entry.name))) {
      const buf = fs.readFileSync(full)
      const text = buf.toString('utf8')
      for (const p of PATTERNS) {
        if (text.includes(p)) {
          bad.push({ file: path.relative(ROOT, full), pattern: p })
        }
      }
    }
  }
}
for (const t of TARGETS) walk(path.join(ROOT, t))

if (bad.length) {
  console.error('Mojibake found:')
  for (const b of bad) console.error(`  ${b.file}: contains "${b.pattern}"`)
  process.exit(1)
} else {
  console.log('Encoding check passed: no mojibake patterns found.')
}
