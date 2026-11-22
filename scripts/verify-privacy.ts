import assert from 'node:assert/strict'
import { buildShareLink, installShareSync, type ShareSyncEnv } from '../src/lib/share'
import { studioDiagnosticsOrigin } from '../src/lib/studioDiagnostics'

const studio = 'https://studio.arc.io'
assert.equal(studioDiagnosticsOrigin(false, studio), undefined)
assert.equal(studioDiagnosticsOrigin(true, studio), studio)
assert.equal(studioDiagnosticsOrigin(true, undefined, 'https://studio-staging.arc.io/path'), 'https://studio-staging.arc.io')
assert.equal(studioDiagnosticsOrigin(true, 'null', studio), undefined)
assert.equal(studioDiagnosticsOrigin(true, 'https://example.invalid', studio), undefined)
assert.equal(studioDiagnosticsOrigin(true, undefined, 'https://studio.arc.io.example.invalid/'), undefined)
assert.equal(studioDiagnosticsOrigin(true, undefined, ''), undefined)
console.log('PASS  Preview diagnostics are scoped to framed Studio origins and reject missing or untrusted parents')

const messages: unknown[] = []
const env = {
  self: {}, top: {}, parent: { postMessage: (data: unknown, origin: string) => messages.push({ data, origin }) },
  referrer: '',
  location: { pathname: '/city', search: '?view=night', hash: '#example-fragment', ancestorOrigins: [studio] },
  history: { pushState() {}, replaceState() {} },
  addEventListener() {},
}
installShareSync(env satisfies ShareSyncEnv)
assert.deepEqual(messages, [{
  data: { type: 'arc-share:navigated', path: '/city', search: '?view=night' },
  origin: studio,
}])
console.log('PASS  Share navigation forwards path and query to Studio and keeps the fragment local')

const top = {}
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  self: top, top, location: { origin: 'https://example.invalid' },
}})
assert.equal(await buildShareLink('/city center?view=night'), 'https://example.invalid/city%20center?view=night')
await assert.rejects(buildShareLink('https://example.invalid/city'), TypeError)
await assert.rejects(buildShareLink('//example.invalid/city'), TypeError)
console.log('PASS  Share link construction encodes game paths and rejects absolute destinations')
