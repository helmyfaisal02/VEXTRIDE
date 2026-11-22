import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const limit = 25 * 1024 * 1024
const files: { path: string; bytes: number }[] = []

async function inspect(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await inspect(path)
    else if (entry.isFile()) files.push({ path, bytes: (await stat(path)).size })
    else throw new Error(`Unexpected build entry: ${path}`)
  }
}

await inspect('dist')
for (const mandatory of ['dist/index.html', 'dist/_headers']) {
  if (!files.some(file => file.path === mandatory && file.bytes > 0)) throw new Error(`Missing Pages asset: ${mandatory}`)
}
for (const { path, bytes } of files) {
  if (bytes > limit) throw new Error(`${path} exceeds the 25 MiB Pages limit`)
  if (/\/(_worker\.js|404\.html)$|\.(?:map|pem|key|p12|keystore)$|\/\.env(?:\.|$)/i.test(path)) {
    throw new Error(`Unexpected production asset: ${path}`)
  }
}
if (files.length > 20_000) throw new Error('Pages Free file limit exceeded')

const biggest = [...files].sort((first, second) => second.bytes - first.bytes).slice(0, 8)
console.log(`Pages assets: ${files.length} files, ${files.reduce((total, file) => total + file.bytes, 0)} bytes total`)
for (const { path, bytes } of biggest) console.log(`${bytes} bytes  ${path}`)
