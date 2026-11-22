// Playwright release QA against a local Vite production preview. No real wallet or RPC submission.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
const { chromium } = await import(process.env.VEXTRIDE_PLAYWRIGHT_MODULE ?? 'playwright')

const origin = process.env.VEXTRIDE_PREVIEW_URL ?? 'http://127.0.0.1:4178'
const evidence = process.env.VEXTRIDE_EVIDENCE_DIR ?? '/tmp/vex73/screens'
const key = 'vextride.guest.progress.v1'
const historyKey = 'vextride.arc.transfers.v1'
const earned = readFileSync(new URL('../phase53/earned-save-fixture.json', import.meta.url), 'utf8')
const sender = '0x' + '11'.repeat(20)
const recipient = '0x' + '22'.repeat(20)
const token = '0x3600000000000000000000000000000000000000'
const hash = '0x' + 'aa'.repeat(32)
const word = hex => hex.replace(/^0x/, '').padStart(64, '0')
const mined = { blockHash: '0x' + 'bb'.repeat(32), blockNumber: '0x11', transactionIndex: '0x0' }
const transaction = {
  ...mined, hash, from: sender, to: token, value: '0x0', chainId: '0x13b2',
  input: '0xa9059cbb' + word(recipient) + word('0x12d687'),
}
const log = {
  ...mined, transactionHash: hash, logIndex: '0x0', address: token, removed: false, data: '0x' + word('0x12d687'),
  topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', '0x' + word(sender), '0x' + word(recipient)],
}
const errors = []
const browser = await chromium.launch({
  executablePath: process.env.VEXTRIDE_CHROMIUM,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
mkdirSync(evidence, { recursive: true })

const button = (root, name) => root.getByRole('button', { name, exact: true })
const screenshot = (page, name) => page.screenshot({ path: evidence + '/' + name + '.jpg', quality: 87 })
const read = (page, name) => page.evaluate(name => localStorage.getItem(name), name)
async function pageIn(context) {
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error' && /webgl|shader/i.test(message.text())) errors.push(message.text())
  })
  return page
}
async function start(page) {
  await page.goto(origin)
  const launch = button(page, 'Arc Wallet')
  await launch.or(button(page, 'Start Playing')).waitFor({ timeout: 60_000 })
  if (await button(page, 'Start Playing').isVisible()) {
    await page.getByRole('textbox', { name: 'Name' }).fill('Release Guest')
    await button(page, 'Start Playing').click()
  }
  await launch.waitFor({ timeout: 60_000 })
}
async function setupWallet(context, rejectsSend) {
  const rpc = { unavailable: false, terminal: '' }
  await context.addInitScript(({ sender, hash, rejectsSend }) => {
    window.calls = []
    const listeners = new Map()
    window.providerListenerCount = () => [...listeners.values()].reduce((total, set) => total + set.size, 0)
    window.ethereum = {
      async request({ method }) {
        window.calls.push(method)
        if (method === 'eth_chainId') return '0x13b2'
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [sender]
        if (method === 'eth_sendTransaction') {
          if (rejectsSend) throw Object.assign(new Error('Mock wallet rejected'), { code: 4001 })
          return hash
        }
        throw new Error('Unexpected mock wallet request')
      },
      on(name, listener) {
        if (!listeners.has(name)) listeners.set(name, new Set())
        listeners.get(name).add(listener)
      },
      removeListener(name, listener) { listeners.get(name)?.delete(listener) },
    }
  }, { sender, hash, rejectsSend })
  await context.route('https://rpc.mainnet.arc.io/**', async route => {
    if (rpc.unavailable) return route.abort('internetdisconnected')
    const { id, method, params } = route.request().postDataJSON()
    const simulation = method === 'eth_call' && params[0].data.startsWith('0xa9059cbb')
    const known = params?.[0] === hash && !!rpc.terminal
    const data = {
      eth_chainId: '0x13b2', eth_getBalance: '0x' + (10n ** 19n).toString(16),
      eth_call: '0x' + word(simulation ? '1' : '989680'),
      eth_estimateGas: '0x9c40', eth_gasPrice: '0x4a817c800', eth_blockNumber: '0x10',
      eth_getTransactionByHash: known ? transaction : null,
      eth_getTransactionReceipt: known ? {
        ...mined, transactionHash: hash, from: sender, to: token,
        status: rpc.terminal === 'confirmed' ? '0x1' : '0x0', logs: rpc.terminal === 'confirmed' ? [log] : [],
      } : null,
    }
    assert.ok(Object.hasOwn(data, method), 'Arc mock received an unexpected RPC operation')
    await route.fulfill({ json: { jsonrpc: '2.0', id, result: data[method] } })
  })
  return rpc
}
async function reviewTransfer(wallet) {
  await wallet.getByRole('textbox', { name: 'Recipient address' }).fill(recipient)
  await wallet.getByRole('textbox', { name: 'Amount in USDC' }).fill('1.234567')
  await button(wallet, 'Review Transfer').click()
  const review = wallet.getByRole('region', { name: 'Transfer review' })
  await review.getByText('1.234567 USDC', { exact: true }).waitFor()
  return button(review, 'Confirm Transfer')
}
async function walletCase(width, height, terminal) {
  const context = await browser.newContext({ viewport: { width, height } })
  const rpc = await setupWallet(context, terminal === 'rejected')
  const page = await pageIn(context)
  const scripts = []
  page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()) })
  await start(page)
  assert.ok(!scripts.some(url => url.includes('ArcWalletContent')))
  assert.deepEqual(await page.evaluate(() => window.calls), [])
  const launcher = button(page, 'Arc Wallet')
  await launcher.focus()
  await page.keyboard.press('Enter')
  const wallet = page.getByRole('dialog', { name: 'Arc Wallet' })
  assert.equal(await button(wallet, 'Close').evaluate(node => node === document.activeElement), true)
  await button(wallet, 'Connect Wallet').click()
  await wallet.getByText('10 USDC', { exact: true }).waitFor()
  await page.waitForFunction(() => localStorage.getItem('vextride.guest.progress.v1') !== null)
  const beforeSave = JSON.parse(await read(page, key))
  assert.equal(await page.getByTestId('street-cash').innerText(), 'STREET CASH: 0 SC')

  if (terminal === 'confirmed') {
    rpc.unavailable = true
    await button(wallet, 'Refresh balance').click()
    await wallet.getByText('Arc RPC unavailable', { exact: true }).waitFor()
    rpc.unavailable = false
    await button(wallet, 'Refresh balance').click()
    await wallet.getByText('10 USDC', { exact: true }).waitFor()
  }
  let peer
  let peerConfirm
  if (terminal === 'confirmed') {
    peer = await pageIn(context)
    await start(peer)
    await button(peer, 'Arc Wallet').click()
    const peerWallet = peer.getByRole('dialog', { name: 'Arc Wallet' })
    await button(peerWallet, 'Connect Wallet').click()
    await peerWallet.getByText('10 USDC', { exact: true }).waitFor()
    peerConfirm = await reviewTransfer(peerWallet)
  }
  const confirm = await reviewTransfer(wallet)
  assert.ok(!(await page.evaluate(() => window.calls)).includes('eth_sendTransaction'))
  await Promise.all([
    confirm.evaluate(node => { node.click(); node.click() }),
    peerConfirm?.evaluate(node => node.click()),
  ])
  const activity = wallet.getByRole('region', { name: 'Recent USDC transfers' })
  const sendCount = source => source.evaluate(() => window.calls.filter(method => method === 'eth_sendTransaction').length)
  let peerSends = 0
  if (terminal === 'rejected') {
    await activity.getByText('User rejected', { exact: true }).waitFor()
  } else {
    await activity.getByText('Pending', { exact: true }).waitFor()
    if (peer) {
      await peer.getByRole('region', { name: 'Recent USDC transfers' }).getByText('Pending', { exact: true }).waitFor()
      peerSends = await sendCount(peer)
      await peer.close()
    }
    rpc.terminal = terminal
    await button(activity, 'Refresh Status').click()
    await activity.getByText(terminal === 'confirmed' ? 'Verified · Confirmed' : 'Verified · Reverted', { exact: true }).waitFor()
    const explorer = activity.getByRole('link', { name: 'View on Explorer' })
    assert.equal(await explorer.getAttribute('href'), 'https://explorer.arc.io/tx/' + hash)
    assert.equal(await explorer.getAttribute('rel'), 'noopener noreferrer')
  }
  const sent = await sendCount(page)
  const journal = JSON.parse(await read(page, historyKey))
  assert.equal(journal.records.length, 1)
  assert.equal(sent + peerSends, 1)
  assert.equal(await wallet.evaluate(node => node.scrollWidth <= node.clientWidth + 1), true)
  await activity.getByRole('heading').evaluate(node => node.scrollIntoView())
  await screenshot(page, 'mock-' + terminal + '-' + width)
  const afterSave = JSON.parse(await read(page, key))
  assert.deepEqual(afterSave.economy, beforeSave.economy)
  assert.deepEqual(afterSave.mission, beforeSave.mission)
  assert.ok(!JSON.stringify(afterSave).includes(sender))
  await button(wallet, 'Disconnect').click()
  await page.waitForFunction(() => window.providerListenerCount() === 0)
  await page.keyboard.press('Escape')
  await wallet.waitFor({ state: 'hidden' })
  assert.equal(await launcher.evaluate(node => node === document.activeElement), true)

  const persisted = await read(page, historyKey)
  await page.reload()
  await launcher.waitFor({ timeout: 60_000 })
  assert.deepEqual(await page.evaluate(() => window.calls), [])
  assert.equal(await read(page, historyKey), persisted)
  console.log('PASS mocked wallet', terminal, width, height)
  await context.close()
}
async function storageCases() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const first = await pageIn(context)
  await start(first)
  await first.waitForFunction(() => localStorage.getItem('vextride.guest.progress.v1') !== null)
  assert.ok(await first.evaluate(() => !!navigator.locks))
  const second = await pageIn(context)
  await start(second)
  await second.evaluate(({ key, earned }) => localStorage.setItem(key, earned), { key, earned })
  await first.getByTestId('guest-save-warning').getByText(/changed in another tab/).waitFor()
  assert.equal(await read(first, key), earned)
  await screenshot(first, 'guest-save-conflict-1280')
  await first.reload()
  await first.getByTestId('street-cash').getByText('STREET CASH: 325 SC', { exact: true }).waitFor()
  await first.getByTestId('guest-save-warning').waitFor({ state: 'hidden' })
  assert.equal(await first.getByRole('button', { name: 'Edit character: Release Guest' }).isVisible(), true)

  await second.evaluate(({ key }) => localStorage.setItem(key, '{interrupted fixture'), { key })
  await first.reload()
  await button(first, 'Arc Wallet').waitFor()
  await first.getByTestId('guest-save-warning').getByText(/needs attention/).waitFor()
  assert.equal(await read(first, key), '{interrupted fixture')
  assert.equal(await first.getByRole('button', { name: 'Edit character: Release Guest' }).isVisible(), true)
  console.log('PASS two-tab revision, guest reload, corrupt save retained and character recovered')
  await context.close()
}

try {
  await storageCases()
  await walletCase(1280, 720, 'confirmed')
  await walletCase(390, 844, 'reverted')
  await walletCase(390, 844, 'rejected')
  assert.deepEqual(errors, [])
  console.log('PASS no uncaught runtime or shader errors')
} finally {
  await browser.close()
}
