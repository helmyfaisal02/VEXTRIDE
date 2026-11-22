// Run against the local Vite dev server. Every wallet and Arc RPC result is mocked.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
const { chromium } = await import(process.env.VEXTRIDE_PLAYWRIGHT_MODULE ?? 'playwright')

const origin = process.env.VEXTRIDE_DEV_URL ?? 'http://127.0.0.1:5178'
const evidence = process.env.VEXTRIDE_EVIDENCE_DIR ?? '/tmp/vex72/screens'
const axeScript = process.env.VEXTRIDE_AXE_SCRIPT
const fixture = readFileSync(new URL('../phase53/earned-save-fixture.json', import.meta.url), 'utf8')
const sender = '0x' + '11'.repeat(20)
const recipient = '0x' + '22'.repeat(20)
const confirmedHash = '0x' + 'aa'.repeat(32)
const pendingHash = '0x' + 'bb'.repeat(32)
const token = '0x3600000000000000000000000000000000000000'
const word = hex => hex.replace(/^0x/, '').padStart(64, '0')
const mined = { blockHash: '0x' + 'cc'.repeat(32), blockNumber: '0x10', transactionIndex: '0x0' }
const transaction = { ...mined, hash: confirmedHash, from: sender, to: token, value: '0x0',
  input: '0xa9059cbb' + word(recipient) + word('0x12d687'), chainId: '0x13b2' }
const receipt = { ...mined, transactionHash: confirmedHash, from: sender, to: token, status: '0x1',
  logs: [{ ...mined, transactionHash: confirmedHash, logIndex: '0x0', address: token, removed: false,
    data: '0x' + word('0x12d687'), topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      '0x' + word(sender), '0x' + word(recipient),
    ] }],
}
const historyTime = Date.now() - 5000
const payoutHistory = {
  version: 1,
  records: [
    { id: '00000000-0000-4000-8000-000000000001', chainId: 5042, sender, recipient,
      amount: '1234567', hash: confirmedHash, status: 'confirmed', createdAt: historyTime,
      checkedAt: historyTime + 1000, head: '15', block: '16', logIndex: 0 },
    { id: '00000000-0000-4000-8000-000000000002', chainId: 5042, sender, recipient,
      amount: '250000', hash: pendingHash, status: 'pending', createdAt: historyTime + 2000,
      checkedAt: null, head: '16', block: null, logIndex: null },
  ],
}
const unknownHistory = { version: 1, records: [
  { ...payoutHistory.records[1], hash: null, status: 'unknown' },
] }
const confirmedHistory = { version: 1, records: [payoutHistory.records[0]] }
const sizes = [[375, 812], [390, 844], [768, 1024], [1280, 720], [1920, 1080]]
const errors = []
const browser = await chromium.launch({
  executablePath: process.env.VEXTRIDE_CHROMIUM,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
mkdirSync(evidence, { recursive: true })

async function openGame({ save = '', history = null, provider = false, width = 390, height = 844 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  await context.addInitScript(({ origin, save, sender, provider, history }) => {
    if (window.location.origin !== origin) return
    if (save && !localStorage.getItem('vextride.guest.progress.v1')) {
      localStorage.setItem('vextride.guest.progress.v1', save)
    }
    if (history) localStorage.setItem('vextride.arc.transfers.v1', JSON.stringify(history))
    window.walletCalls = []
    window.arcChain = '0x13b2'
    const events = new Map()
    window.emitWalletEvent = (type, data) => events.get(type)?.forEach(listener => listener(data))
    if (provider) window.ethereum = {
      async request({ method }) {
        window.walletCalls.push(method)
        if (method === 'eth_chainId') return window.arcChain
        if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [sender]
        throw new Error('Automation prohibits wallet signing and sending')
      },
      on(type, listener) {
        if (!events.has(type)) events.set(type, new Set())
        events.get(type).add(listener)
      },
      removeListener(type, listener) { events.get(type)?.delete(listener) },
    }
  }, { origin, save, sender, provider, history })
  await context.route('https://rpc.mainnet.arc.io/**', async route => {
    const { id, method, params } = route.request().postDataJSON()
    const isSimulation = method === 'eth_call' && params[0].data.startsWith('0xa9059cbb')
    const responses = {
      eth_chainId: '0x13b2',
      eth_call: '0x' + (isSimulation ? 1 : 10000000).toString(16).padStart(64, '0'),
      eth_getBalance: '0x' + (10n ** 19n).toString(16),
      eth_estimateGas: '0x9c40',
      eth_gasPrice: '0x4a817c800',
      eth_blockNumber: '0x10',
      eth_getTransactionByHash: params?.[0] === confirmedHash ? transaction : null,
      eth_getTransactionReceipt: params?.[0] === confirmedHash ? receipt : null,
    }
    await route.fulfill({ json: { jsonrpc: '2.0', id, result: responses[method] ?? null } })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && /shader|webgl/i.test(message.text())) errors.push(message.text())
  })
  await page.goto(origin)
  await button(page, 'Start Playing').waitFor({ timeout: 60_000 })
  return { page, context }
}

const button = (page, name) => page.getByRole('button', { name, exact: true })
const settingsButton = page => page.getByRole('button', { name: /Edit character/ })
const isFocused = locator => locator.evaluate(node => node === node.ownerDocument.activeElement)
const shot = (page, name) => page.screenshot({ path: evidence + '/' + name + '.jpg', quality: 87 })
const waitForFocus = async locator => {
  const element = await locator.elementHandle()
  await element.waitForElementState('visible')
  await locator.page().waitForFunction(node => node === document.activeElement, element)
  await element.dispose()
}
async function playable(page) {
  await page.getByRole('textbox', { name: 'Name' }).fill('Viewport')
  await button(page, 'Start Playing').click()
  await button(page, 'Arc Wallet').waitFor({ timeout: 60_000 })
  await page.evaluate(() => {
    window.moduleAt = path => import(performance.getEntriesByType('resource')
      .filter(entry => new URL(entry.name).pathname === path).at(-1)?.name ?? path)
  })
}
async function checkPanel(panel) {
  assert.ok(await panel.evaluate(node => {
    const rect = node.getBoundingClientRect()
    return node.scrollWidth <= node.clientWidth + 1 &&
      rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight
  }))
}
async function scan(page, label, selector) {
  if (!axeScript) return
  if (!await page.evaluate(() => !!window.axe)) await page.addScriptTag({ path: axeScript })
  const findings = await page.evaluate(async selector => {
    const result = await window.axe.run(selector, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })
    return { passed: result.passes.length, violations: result.violations.map(item => ({ rule: item.id, nodes: item.nodes.map(node => node.target) })) }
  }, selector)
  console.log('AXE', label, JSON.stringify(findings))
}
async function placePlayer(page, target) {
  await page.evaluate(async target => {
    const { vehicleRuntime } = await window.moduleAt('/src/game/vehicles/vehicleState.ts')
    const { GARAGE } = await window.moduleAt('/src/game/garage/garageConfig.ts')
    const { NPCS } = await window.moduleAt('/src/game/npcs/npcConfig.ts')
    const pos = target === 'garage' ? GARAGE.terminal : target === 'maya'
      ? NPCS.find(npc => npc.id === 'maya').spawn : vehicleRuntime.body.translation()
    vehicleRuntime.pedestrian.setTranslation({
      x: pos.x + (target === 'maya' ? -2 : target === 'car' ? -1.8 : 0),
      y: pos.y + (target === 'car' ? 0.42 : 0.96),
      z: pos.z + (target === 'garage' ? 1.5 : 0),
    }, true)
    vehicleRuntime.pedestrian.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }, target)
}
async function time(page, hour) {
  await page.evaluate(async hour => {
    const { worldClock } = await window.moduleAt('/src/game/world/worldTime.ts')
    worldClock.setPaused(true)
    worldClock.setHour(hour)
  }, hour)
}
async function sceneMetrics(page) {
  return page.evaluate(async () => {
    const fiber = await import(performance.getEntriesByType('resource').find(r => r.name.includes('/@react-three_fiber.js')).name)
    const live = fiber._roots.get(document.querySelector('canvas')).store.getState()
    const { vehicleRuntime } = await window.moduleAt('/src/game/vehicles/vehicleState.ts')
    const geometries = new Set()
    live.scene.traverse(object => { if (object.geometry) geometries.add(object.geometry) })
    return {
      bodies: vehicleRuntime.pedestrian.rawSet.len(), colliders: vehicleRuntime.pedestrian.colliderSet.len(),
      callbacks: live.internal.subscribers.length, geometries: geometries.size,
    }
  })
}

try {
  const { page, context } = await openGame({ save: fixture, provider: true })
  const creator = page.getByRole('dialog', { name: 'Create Your Character' })
  await checkPanel(creator)
  await waitForFocus(creator.getByRole('heading'))
  await page.keyboard.press('Tab')
  await waitForFocus(page.getByRole('textbox', { name: 'Name' }))
  const focusStyle = await page.getByRole('textbox', { name: 'Name' }).evaluate(node => getComputedStyle(node).outlineStyle)
  assert.equal(focusStyle, 'solid')
  await page.keyboard.press('Tab')
  assert.match(await page.evaluate(() => document.activeElement.type), /radio/)
  const firstPreset = page.getByRole('radio', { checked: true })
  const initialPreset = await firstPreset.evaluate(node => node.parentElement.textContent)
  await page.keyboard.press('ArrowRight')
  assert.notEqual(await firstPreset.evaluate(node => node.parentElement.textContent), initialPreset)
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    assert.ok(await creator.evaluate(node => node.contains(document.activeElement)))
  }
  await page.keyboard.press('Escape')
  assert.ok(await creator.isVisible())
  await shot(page, 'after-creator-390')
  await scan(page, 'creator', '[role="dialog"]')
  await playable(page)
  await time(page, 14)
  assert.deepEqual(await page.evaluate(() => window.walletCalls), [])
  const initialMetrics = await sceneMetrics(page)
  await page.keyboard.press('F')

  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height })
    await shot(page, 'after-hud-' + width)
    const launcher = button(page, 'Arc Wallet')
    await launcher.focus()
    await page.keyboard.press('Space')
    const wallet = page.getByRole('dialog', { name: 'Arc Wallet' })
    await waitForFocus(button(wallet, 'Close'))
    await button(wallet, 'Connect Wallet').or(button(wallet, 'Disconnect')).waitFor()
    if (await button(wallet, 'Connect Wallet').isVisible()) {
      assert.deepEqual(await page.evaluate(() => window.walletCalls), [])
      await button(wallet, 'Connect Wallet').click()
    }
    await wallet.getByText('Connected to Arc Mainnet', { exact: true }).waitFor()
    await wallet.getByText('10 USDC', { exact: true }).waitFor()
    await checkPanel(wallet)
    await shot(page, 'after-wallet-' + width)
    await page.keyboard.press('Escape')
    await waitForFocus(launcher)
    console.log('PASS viewport and modal geometry', width, height)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(() => { document.documentElement.style.fontSize = '150%' })
  await button(page, 'Arc Wallet').click()
  const wallet = page.getByRole('dialog', { name: 'Arc Wallet' })
  await checkPanel(wallet)
  assert.equal(await button(wallet, 'Close').evaluate(node => getComputedStyle(node).transitionDuration), '0s')
  for (let i = 0; i < 16; i++) {
    await page.keyboard.press('Tab')
    const outsideControl = await page.evaluate(() => {
      const active = document.activeElement
      return active !== document.body && !active.closest('dialog[open]')
    })
    assert.equal(outsideControl, false)
  }

  const to = wallet.getByRole('textbox', { name: 'Recipient address' })
  const amount = wallet.getByRole('textbox', { name: 'Amount in USDC' })
  await to.fill('incorrect')
  await amount.fill('1.234567')
  await button(wallet, 'Review Transfer').click()
  await wallet.getByText('Enter a complete EVM recipient address.', { exact: true }).waitFor()
  const describedBy = await to.getAttribute('aria-describedby')
  assert.equal(await page.evaluate(id => document.getElementById(id).textContent, describedBy), 'Enter a complete EVM recipient address.')
  await to.fill(recipient)
  await button(wallet, 'Review Transfer').click()
  const quote = wallet.getByRole('region', { name: 'Transfer review' })
  await waitForFocus(quote.getByRole('heading'))
  const text = await quote.innerText()
  assert.match(text, /1\.234567 USDC/)
  assert.match(text, /Estimated network fee \(cap\)/)
  assert.ok(text.includes(recipient))
  await checkPanel(wallet)
  await quote.getByRole('heading').evaluate(heading => heading.scrollIntoView({ block: 'center' }))
  await shot(page, 'after-wallet-review-large')
  await scan(page, 'wallet review', 'dialog[open]')
  await page.keyboard.press('Tab')
  assert.ok(await isFocused(button(quote, 'Cancel')))
  await page.keyboard.press('Tab')
  assert.ok(await isFocused(button(quote, 'Confirm Transfer')))
  await page.keyboard.press('Escape')
  await quote.waitFor({ state: 'hidden' })
  await waitForFocus(button(wallet, 'Review Transfer'))
  assert.deepEqual((await page.evaluate(() => window.walletCalls)).filter(method => /sign|send/i.test(method)), [])
  await page.evaluate(() => {
    window.arcChain = '0x1'
    window.emitWalletEvent('chainChanged', window.arcChain)
  })
  await wallet.getByText('Wrong network', { exact: true }).waitFor()
  await to.waitFor({ state: 'hidden' })
  await page.keyboard.press('Escape')
  await waitForFocus(button(page, 'Arc Wallet'))
  assert.equal(await page.getByTestId('street-cash').innerText(), 'STREET CASH: 325 SC')
  await page.evaluate(() => { document.documentElement.style.fontSize = '' })

  await page.keyboard.down('w')
  await settingsButton(page).click()
  const edit = page.getByRole('dialog', { name: 'Edit Your Character' })
  await waitForFocus(edit.getByRole('heading'))
  const held = async () => page.evaluate(async () => (await window.moduleAt('/src/game/input/inputState.ts')).inputState)
  assert.ok(Object.values(await held()).every(value => !value))
  await page.keyboard.down('Shift')
  await page.keyboard.press('t')
  await page.keyboard.up('Shift')
  await page.keyboard.press('f')
  await page.keyboard.press('Escape')
  await waitForFocus(settingsButton(page))
  assert.equal(await page.getByRole('region', { name: 'Developer world time' }).count(), 0)
  assert.ok(await page.getByText(/fps  .*ms/).isVisible())
  assert.equal((await held()).forward, false)
  await page.keyboard.up('w')
  await page.keyboard.down('w')
  assert.equal((await held()).forward, true)
  await page.keyboard.up('w')

  await placePlayer(page, 'garage')
  await page.getByTestId('garage-hint').waitFor()
  await page.keyboard.press('e')
  const garage = page.getByRole('dialog', { name: 'Motor Row Garage' })
  await waitForFocus(button(garage, 'Close garage'))
  await checkPanel(garage)
  assert.equal(await garage.getByTestId('garage-occupancy').innerText(), '1 / 2 bays occupied')
  const reset = button(garage, 'Reset guest progress')
  await reset.click()
  await waitForFocus(button(garage, 'Cancel reset'))
  await page.keyboard.press('Escape')
  await waitForFocus(reset)
  const select = garage.getByRole('combobox', { name: 'New body color' })
  const otherColor = await select.locator('option:not(:checked)').first().getAttribute('value')
  await select.selectOption(otherColor)
  const reviewRespray = button(garage, 'Review respray')
  await reviewRespray.click()
  await waitForFocus(button(garage, 'Cancel respray'))
  await checkPanel(garage)
  await shot(page, 'after-garage-confirm-390')
  await scan(page, 'garage respray', '[data-testid="garage-panel"]')
  await page.keyboard.press('Escape')
  await waitForFocus(reviewRespray)
  await page.keyboard.press('Escape')
  await garage.waitFor({ state: 'hidden' })
  assert.equal(await page.getByTestId('street-cash').innerText(), 'STREET CASH: 325 SC')

  await placePlayer(page, 'car')
  await page.getByTestId('vehicle-hint').waitFor()
  await page.keyboard.press('e')
  await page.getByText('0 km/h · N · Stopped', { exact: true }).waitFor()
  await page.locator('.vex-controls-compact summary').focus()
  await page.keyboard.press('Space')
  assert.equal(await page.locator('.vex-controls-compact').getAttribute('open'), '')
  assert.equal((await held()).jumpHeld, false)
  assert.ok(await page.evaluate(() => {
    const bounds = selector => document.querySelector(selector).getBoundingClientRect()
    return bounds('.vex-controls-compact').bottom <= bounds('[data-testid=vehicle-hud]').top &&
      bounds('[data-testid=vehicle-hud]').bottom < bounds('.studio-watermark').top
  }))
  await time(page, 2.45)
  await page.waitForTimeout(800)
  await shot(page, 'after-driving-night-390')
  await page.keyboard.press('Space')
  await time(page, 14)
  await shot(page, 'after-driving-390')
  // A test-only text field while genuinely inside the Rapier car.
  await page.evaluate(() => {
    const field = document.createElement('input')
    field.id = 'driving-input-probe'
    document.body.append(field)
    field.focus()
  })
  await page.keyboard.type('wasder fpc')
  assert.ok(Object.values(await held()).every(value => !value))
  await page.evaluate(() => document.getElementById('driving-input-probe').remove())
  await page.keyboard.press('e')
  await page.getByText('0 km/h · N · Stopped', { exact: true }).waitFor({ state: 'hidden' })
  assert.deepEqual(await sceneMetrics(page), initialMetrics)
  console.log('PASS creator, game input, mock quote/review, garage cancellation, resource counts', initialMetrics)
  await context.close()

  const mission = await openGame()
  await playable(mission.page)
  await placePlayer(mission.page, 'maya')
  await mission.page.getByTestId('npc-hint').waitFor()
  await mission.page.keyboard.press('e')
  const maya = mission.page.getByRole('dialog', { name: 'Maya' })
  await waitForFocus(button(maya, 'Close conversation'))
  await mission.page.keyboard.press('Shift+Tab')
  await waitForFocus(button(maya, 'Continue'))
  await mission.page.keyboard.press('Tab')
  await waitForFocus(button(maya, 'Close conversation'))
  await button(maya, 'Start First Contact').click()
  await waitForFocus(button(maya, 'Accept First Contact'))
  await button(maya, 'Not now').click()
  await maya.waitFor({ state: 'hidden' })
  await mission.page.keyboard.press('e')
  await button(maya, 'Start First Contact').click()
  await button(maya, 'Accept First Contact').click()
  await mission.page.getByTestId('mission-hud').getByText(/Talk to Marcus/).waitFor()
  await time(mission.page, 2.45)
  await shot(mission.page, 'after-mission-night-390')
  assert.deepEqual(await mission.page.evaluate(() => window.walletCalls), [])
  await mission.context.close()
  console.log('PASS no-wallet NPC focus, mission decline and acceptance')

  for (const [label, history] of [['pending', payoutHistory], ['unknown', unknownHistory], ['verified', confirmedHistory]]) {
    const activity = await openGame({ history, provider: true, width: 375, height: 812 })
    await playable(activity.page)
    await button(activity.page, 'Arc Wallet').click()
    await button(activity.page, 'Connect Wallet').click()
    const panel = activity.page.getByRole('dialog', { name: 'Arc Wallet' })
    const list = panel.getByRole('region', { name: 'Recent USDC transfers' })
    if (label === 'pending') {
      await list.getByText('Pending', { exact: true }).waitFor()
      await list.getByText('Saved · Confirmed', { exact: true }).waitFor()
      assert.ok(await list.getByRole('link', { name: 'View on Explorer' }).first().isVisible())
    } else if (label === 'verified') {
      const saved = list.getByRole('listitem').filter({ hasText: 'Saved · Confirmed' })
      await button(saved, 'Refresh Status').click()
      await list.getByText('Verified · Confirmed', { exact: true }).waitFor()
      await list.getByRole('textbox', { name: 'Inspect an Arc transaction hash' }).fill(confirmedHash)
      await button(list, 'Inspect Hash').click()
      await list.getByText('Arc receipt succeeded · Block 16', { exact: true }).waitFor()
    } else {
      await list.getByText('Unknown', { exact: true }).waitFor()
      await list.getByRole('textbox', { name: 'Matching mined transaction hash' }).waitFor()
      assert.ok(await button(list, 'Verify and recover').isDisabled())
    }
    await checkPanel(panel)
    await list.getByRole('heading').evaluate(node => node.scrollIntoView())
    await shot(activity.page, 'after-history-' + label + '-375')
    await activity.context.close()
  }
  assert.deepEqual(errors, [])
  console.log('PASS mobile saved/pending/unknown/verified history, read-only hash lookup and zero runtime or shader errors')
} finally {
  await browser.close()
}
