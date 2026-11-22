import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const dist = resolve(process.argv[2] ?? 'dist')
const origin = 'http://127.0.0.1:4178'
const signatures = {
  development: /studio-trace-event|studio-console-log|\/@vite\/client|\/src\/main\.tsx/,
  privateKey: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/,
  githubCredential: /\b(?:gh[pousr]_[\w]{36}|github_pat_[\w]{82})\b/,
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

function list(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = prefix + entry.name
    if (entry.isDirectory()) return list(join(dir, entry.name), path + '/')
    assert.ok(entry.isFile(), 'Build output must contain regular files only')
    return [path]
  })
}

function inventory() {
  return list(dist).sort().map(path => {
    assert.ok(!/(?:^|\/)\.env(?:\.|$)|\.(?:map|pem|p12|key|keystore)$/i.test(path), 'Unexpected file kind in dist/')
    const bytes = readFileSync(join(dist, path))
    if (/\.(?:html|js|css)$/.test(path)) {
      const content = bytes.toString('utf8')
      for (const [kind, pattern] of Object.entries(signatures)) {
        assert.ok(!pattern.test(content), kind + ' signature in ' + path)
      }
    }
    return { path, bytes: bytes.length, gzipBytes: gzipSync(bytes).length, sha256: sha256(bytes) }
  })
}

const artifacts = inventory()
const byPath = new Map(artifacts.map(file => [file.path, file]))
const index = byPath.get('index.html')
assert.ok(index, 'Missing index.html')
const html = readFileSync(join(dist, 'index.html'), 'utf8')
const startup = [...html.matchAll(/\b(?:src|href)="\/(assets\/[^"]+)"/g)].map(match => match[1])
assert.ok(startup.some(path => path.endsWith('.js')), 'Missing module entry')
assert.ok(startup.some(path => path.endsWith('.css')), 'Missing stylesheet')
assert.ok(startup.every(path => byPath.has(path)), 'HTML references a missing artifact')
assert.ok(artifacts.some(file => /^assets\/ArcWalletContent-.*\.js$/.test(file.path)), 'Missing lazy wallet chunk')
assert.ok(startup.every(path => !path.includes('ArcWalletContent')), 'Wallet chunk must not be preloaded')

const contentType = path => path.endsWith('.js') ? /\bjavascript\b/ : path.endsWith('.css') ? /^text\/css\b/ : /^text\/html\b/
async function served(path, artifact) {
  const response = await fetch(origin + path, {
    redirect: 'error', signal: AbortSignal.timeout(10_000),
    headers: { Accept: contentType(artifact.path).test('text/html') ? 'text/html' : '*/*' },
  })
  assert.equal(response.status, 200, 'Unexpected status for ' + path)
  assert.match(response.headers.get('content-type') ?? '', contentType(artifact.path), path)
  assert.equal(sha256(Buffer.from(await response.arrayBuffer())), artifact.sha256, 'HTTP bytes differ for ' + path)
  return { path, status: response.status, type: response.headers.get('content-type') }
}

const http = []
if (!process.argv.includes('--inventory-only')) {
  // Pages consumes _headers as deployment metadata. It is not a public asset.
  for (const file of artifacts.filter(file => file.path !== '_headers')) {
    http.push(await served('/' + file.path, file))
  }
  for (const route of ['/', '/qa/release/nested']) http.push(await served(route, index))
}

console.log(JSON.stringify({ artifacts, startup, http }, null, 2))
