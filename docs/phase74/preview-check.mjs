// Browser QA against the unmodified dist/ served by Vite preview on loopback.
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const { chromium } = await import(process.env.VEXTRIDE_PLAYWRIGHT_MODULE ?? 'playwright')

const origin = 'http://127.0.0.1:4178'
const evidence = process.env.VEXTRIDE_EVIDENCE_DIR ?? '/tmp/vex74/preview'
const profile = mkdtempSync(join(tmpdir(), 'vextride-qa-'))
const sender = '0x' + '11'.repeat(20)
const hash = '0x' + 'ab'.repeat(32)
const mockMethods = []
const results = { browser: null, viewports: [], assetRequests: [], externalResources: [], errors: [] }
const assets = new Map()
const external = new Map()
const sizes = [[375, 812], [390, 844], [768, 1024], [1280, 720], [1920, 1080]]
const contextOptions = {
  executablePath: process.env.VEXTRIDE_CHROMIUM,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
}

function button(root, name) {
  return root.getByRole('button', { name, exact: true })
}
async function shot(page, name) {
  await page.screenshot({ path: join(evidence, name + '.jpg'), quality: 85 })
}
async function assertFocused(locator) {
  assert.equal(await locator.evaluate(node => node.ownerDocument.activeElement === node), true)
}
async function healthCanvas(page) {
  return page.evaluate(() => window.releaseProbe.draws)
}

async function openProfile(injected) {
  const context = await chromium.launchPersistentContext(profile, contextOptions)
  await context.addInitScript(({ injected, sender }) => {
    window.releaseProbe = { draws: 0, providerCalls: [], listeners: new Map(), loss: 'none' }
    const original = WebGL2RenderingContext.prototype.drawElements
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      window.releaseProbe.draws++
      return original.apply(this, args)
    }
    if (injected) {
      window.ethereum = {
        async request({ method }) {
          window.releaseProbe.providerCalls.push(method)
          if (method === 'eth_chainId') return '0x13b2'
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [sender]
          throw new Error('Release profile permits only mocked account inspection')
        },
        on(name, handler) {
          const listeners = window.releaseProbe.listeners.get(name) ?? new Set()
          listeners.add(handler)
          window.releaseProbe.listeners.set(name, listeners)
        },
        removeListener(name, handler) {
          window.releaseProbe.listeners.get(name)?.delete(handler)
        },
      }
    }
  }, { injected, sender })
  await context.route('https://rpc.mainnet.arc.io/**', async route => {
    const { id, method } = route.request().postDataJSON()
    mockMethods.push(method)
    const data = {
      eth_chainId: '0x13b2', eth_call: '0x' + (10000000).toString(16).padStart(64, '0'),
      eth_getTransactionByHash: null, eth_getTransactionReceipt: null,
    }
    assert.ok(Object.hasOwn(data, method))
    await route.fulfill({ json: { jsonrpc: '2.0', id, result: data[method] } })
  })
  const page = context.pages()[0]
  page.on('pageerror', error => results.errors.push(error.message))
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === origin && url.pathname.startsWith('/assets/')) {
      assets.set(url.pathname, { path: url.pathname, status: response.status(), type: response.headers()['content-type'] })
    } else if (url.origin !== origin) {
      external.set(url.origin, { origin: url.origin, response: response.status() })
    }
  })
  page.on('requestfailed', request => {
    const url = new URL(request.url())
    if (url.origin === origin && url.pathname.startsWith('/assets/')) {
      results.errors.push('Failed local asset ' + url.pathname)
    } else if (url.origin !== origin) {
      external.set(url.origin, { origin: url.origin, failure: request.failure()?.errorText })
    }
  })
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      results.errors.push(message.text())
    }
  })
  return { context, page }
}

mkdirSync(evidence, { recursive: true })
let context
try {
  let page
  ;({ context, page } = await openProfile(true))
  results.browser = context.browser()?.version() ?? await page.evaluate(() => navigator.userAgent)
  await page.setViewportSize({ width: 375, height: 812 })
  const nested = await page.goto(origin + '/qa/release/nested?view=check')
  assert.equal(nested.status(), 200)
  assert.match(nested.headers()['content-type'], /^text\/html/)
  const creator = page.getByRole('dialog', { name: 'Create Your Character' })
  await creator.waitFor({ timeout: 60_000 })
  await assertFocused(creator.getByRole('heading'))
  await page.keyboard.press('Tab')
  await assertFocused(creator.getByRole('textbox', { name: 'Name' }))
  await creator.getByRole('textbox', { name: 'Name' }).fill('Release Guest')
  await shot(page, 'creator-375')
  await button(creator, 'Start Playing').click()
  const launcher = button(page, 'Arc Wallet')
  await launcher.waitFor({ timeout: 60_000 })
  assert.ok(await page.evaluate(() => isSecureContext && !!navigator.locks))
  assert.equal(assets.size >= 4, true)
  assert.ok(![...assets.keys()].some(path => path.includes('ArcWalletContent')))
  assert.deepEqual(await page.evaluate(() => window.releaseProbe.providerCalls), [])
  assert.ok(await page.evaluate(() => window.releaseProbe.listeners.size === 0))
  const animationStart = await healthCanvas(page)
  await page.keyboard.down('w')
  await page.waitForTimeout(350)
  await page.keyboard.up('w')
  assert.ok(await healthCanvas(page) > animationStart)
  results.deepLink = { status: nested.status(), path: '/qa/release/nested', secureContext: true, webLocks: true }

  const clock = page.getByTestId('world-time')
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height })
    await clock.waitFor()
    await page.getByTestId('street-cash').waitFor()
    await shot(page, 'hud-' + width)
    await launcher.focus()
    await page.keyboard.press('Enter')
    const wallet = page.getByRole('dialog', { name: 'Arc Wallet' })
    await wallet.waitFor()
    await assertFocused(button(wallet, 'Close'))
    const connect = button(wallet, 'Connect Wallet')
    await connect.waitFor()
    assert.ok([...assets.keys()].some(path => path.includes('ArcWalletContent')))
    await connect.click()
    await wallet.getByText('10 USDC', { exact: true }).waitFor()
    const fits = await wallet.evaluate(node => {
      const box = node.getBoundingClientRect()
      return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight
        && node.scrollWidth <= node.clientWidth + 1
    })
    assert.ok(fits)
    if (width === 390) {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.evaluate(() => { document.documentElement.style.fontSize = '150%' })
      assert.equal(await wallet.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true)
      assert.equal(await button(wallet, 'Close').evaluate(node => getComputedStyle(node).transitionDuration), '0s')
      await shot(page, 'wallet-390-large')
      await page.evaluate(() => { document.documentElement.style.fontSize = '' })
    }
    await button(wallet, 'Disconnect').click()
    assert.equal(await page.evaluate(() => [...window.releaseProbe.listeners.values()].reduce((n, group) => n + group.size, 0)), 0)
    await page.keyboard.press('Escape')
    await assertFocused(launcher)
    results.viewports.push({ width, height, hud: 'visible', walletFits: fits, focusRestored: true })
  }

  await launcher.click()
  const wallet = page.getByRole('dialog', { name: 'Arc Wallet' })
  const history = wallet.getByRole('region', { name: 'Recent USDC transfers' })
  const beforeLookup = await page.evaluate(() => ({
    calls: window.releaseProbe.providerCalls.length,
    history: localStorage.getItem('vextride.arc.transfers.v1'),
  }))
  await history.getByRole('textbox', { name: 'Inspect an Arc transaction hash' }).fill(hash)
  await button(history, 'Inspect Hash').click()
  await history.getByText(/no mined receipt/i).waitFor()
  assert.deepEqual(await page.evaluate(() => ({
    calls: window.releaseProbe.providerCalls.length,
    history: localStorage.getItem('vextride.arc.transfers.v1'),
  })), beforeLookup)
  await page.keyboard.press('Escape')

  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context')
    if (!extension) throw new Error('WEBGL_lose_context unavailable')
    canvas.addEventListener('webglcontextlost', event => {
      window.releaseProbe.loss = event.defaultPrevented ? 'prevented' : 'unhandled'
      setTimeout(() => extension.restoreContext(), 700)
    }, { once: true })
    canvas.addEventListener('webglcontextrestored', () => {
      if (window.releaseProbe.loss === 'prevented') window.releaseProbe.loss = 'restored'
    }, { once: true })
    extension.loseContext()
  })
  await page.waitForFunction(() => window.releaseProbe.loss === 'restored')
  const recoveryDraws = await healthCanvas(page)
  await page.waitForFunction(before => window.releaseProbe.draws > before, recoveryDraws)
  results.contextRecovery = true
  await page.reload()
  await launcher.waitFor({ timeout: 60_000 })
  assert.deepEqual(await page.evaluate(() => window.releaseProbe.providerCalls), [])
  await context.close()
  context = null

  ;({ context, page } = await openProfile(false))
  await page.goto(origin)
  await button(page, 'Arc Wallet').waitFor({ timeout: 60_000 })
  assert.ok(await page.getByRole('button', { name: 'Edit character: Release Guest' }).isVisible())
  assert.equal(await page.evaluate(() => !!window.ethereum), false)
  results.refreshAndProfileReopen = true
  results.readOnlyLookup = { providerRequests: 0, historyMutation: false, evidence: 'mocked missing receipt' }
  assert.deepEqual(results.errors, [])
  console.log('PASS production deep link, lazy wallet, five viewports, enlarged text, read-only lookup, WebGL recovery and profile reopening')
} finally {
  results.assetRequests = [...assets.values()]
  results.externalResources = [...external.values()]
  results.mockRpcMethods = Object.fromEntries([...new Set(mockMethods)].map(method => [method, mockMethods.filter(item => item === method).length]))
  if (context) await context.close()
  rmSync(profile, { recursive: true, force: true })
  writeFileSync(join(evidence, 'preview.json'), JSON.stringify(results, null, 2) + '\n')
}
