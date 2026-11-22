// Run with Bun after forge build and bun run build:pages. All wallet and Arc RPC calls are mocked.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import {
  encodeAbiParameters, encodeEventTopics, keccak256, toHex,
} from 'viem'
import { ROUTER, routerAbi, routerTokenAbi } from '../../src/game/blockchain/routerContract'
import { ARC_MAINNET } from '../../src/game/blockchain/arcConfig'

const { chromium } = await import(process.env.VEXTRIDE_PLAYWRIGHT_MODULE ?? 'playwright')
const root = resolve('dist')
const payer = '0x1111111111111111111111111111111111111111'
const chain = '0x13b2'
const token = ARC_MAINNET.usdcAddress
const router = ROUTER.address.toLowerCase()
const amount = 1_234_567n
const word = value => encodeAbiParameters([{ type: 'uint256' }], [value])
const addrWord = address => word(BigInt(address))
const hash32 = byte => '0x' + byte.repeat(32)
const approvalHash = hash32('10')
const paymentHash = hash32('20')
const blockHash = hash32('34')
const selectors = {
  recipient: '0x66d003ac', usdc: '0x3e413bee', used: '0xc90474cf',
  balance: '0x70a08231', allowance: '0xdd62ed3e', approve: '0x095ea7b3', pay: '0xd0ee4de0',
}

const compiled = JSON.parse(readFileSync('contracts/out/VextridePaymentRouter.sol/VextridePaymentRouter.json', 'utf8'))
const { object, immutableReferences } = compiled.deployedBytecode
let runtime = object
for (const { start, length } of Object.values(immutableReferences).flat()) {
  assert.equal(length, 32)
  const offset = 2 + start * 2
  runtime = runtime.slice(0, offset) + addrWord(ROUTER.recipient).slice(2) + runtime.slice(offset + length * 2)
}
assert.equal(keccak256(runtime), ROUTER.runtimeHash)
const headers = new Headers()
for (const line of readFileSync(resolve(root, '_headers'), 'utf8').split('\n')) {
  if (line.startsWith('/assets/')) break
  const separator = line.indexOf(':')
  if (separator > 0) headers.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim())
}

const server = Bun.serve({
  port: 0, hostname: '127.0.0.1',
  async fetch(request) {
    const pathname = new URL(request.url).pathname
    const path = resolve(root, '.' + pathname)
    if (pathname.startsWith('/assets/') && path.startsWith(root + sep)) {
      const asset = Bun.file(path)
      if (!(await asset.exists())) return new Response(null, { status: 404 })
      return new Response(asset, { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } })
    }
    if (pathname.startsWith('/assets/')) return new Response(null, { status: 404 })
    return new Response(Bun.file(resolve(root, 'index.html')), { headers })
  },
})

const browser = await chromium.launch({
  executablePath: process.env.VEXTRIDE_CHROMIUM,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const button = (scope, name) => scope.getByRole('button', { name, exact: true })
let block = 100n
let allowance = 0n
let available = 10_000_000n
let nativeBalance = 10n ** 19n
let payMined = false
const transactions = new Map()
const publicMethods = new Set()
const sends = []
const reportedErrors = []
const assets = new Set()

function settlement(hash, transaction) {
  const approval = hash === approvalHash
  const blockNumber = toHex(approval ? 101n : 102n)
  const mined = { blockNumber, blockHash, transactionIndex: '0x0', transactionHash: hash }
  const event = (address, logIndex, topics, data = word(amount)) => ({ ...mined, address, logIndex, topics, data, removed: false })
  const logs = approval
    ? [event(token, '0x0', encodeEventTopics({ abi: routerTokenAbi, eventName: 'Approval', args: { owner: payer, spender: ROUTER.address } }))]
    : [
      event('0xfffffffffffffffffffffffffffffffffffffffe', '0x0',
        encodeEventTopics({ abi: routerTokenAbi, eventName: 'Transfer', args: { from: payer, to: ROUTER.recipient } }), word(amount * 10n ** 12n)),
      event(token, '0x1', encodeEventTopics({ abi: routerTokenAbi, eventName: 'Transfer', args: { from: payer, to: ROUTER.recipient } })),
      event(router, '0x2', encodeEventTopics({
        abi: routerAbi, eventName: 'PaymentSettled',
        args: { payer, recipient: ROUTER.recipient, paymentReference: '0x' + transaction.data.slice(10, 74) },
      })),
    ]
  return {
    tx: { ...mined, hash, to: transaction.to, from: payer, input: transaction.data, value: '0x0', type: '0x2',
      chainId: chain, gas: '0x20000', maxFeePerGas: '0x4a817c800', maxPriorityFeePerGas: '0x0', nonce: '0x0' },
    receipt: { ...mined, status: '0x1', type: '0x2', from: payer, to: transaction.to,
      gasUsed: '0x12000', cumulativeGasUsed: '0x12000', effectiveGasPrice: '0x4a817c800', contractAddress: null,
      logsBloom: '0x' + '00'.repeat(256), logs },
  }
}

function rpcResult(method, params) {
  publicMethods.add(method)
  if (method === 'eth_chainId') return chain
  if (method === 'eth_getCode') {
    assert.equal(params[0].toLowerCase(), router)
    return runtime
  }
  if (method === 'eth_getBalance') return toHex(nativeBalance)
  if (method === 'eth_blockNumber') return toHex(block)
  if (method === 'eth_gasPrice') return toHex(20_000_000_000n)
  if (method === 'eth_estimateGas') return '0x14000'
  if (method === 'eth_call') {
    const data = (params[0].data ?? params[0].input).slice(0, 10)
    if (data === selectors.recipient) return addrWord(ROUTER.recipient)
    if (data === selectors.usdc) return addrWord(token)
    if (data === selectors.allowance) return word(allowance)
    if (data === selectors.used) return word(0n)
    if (data === selectors.balance) return word(available)
    if (data === selectors.approve) return word(1n)
    if (data === selectors.pay) return '0x'
  }
  if (method === 'eth_getTransactionByHash' || method === 'eth_getTransactionReceipt') {
    const hash = params[0]
    if (hash === paymentHash && !payMined) return null
    const item = transactions.get(hash)
    if (!item) return null
    return method === 'eth_getTransactionByHash' ? item.tx : item.receipt
  }
  throw new Error(`Unexpected RPC method or calldata: ${method}`)
}

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await context.exposeBinding('mockVextrideSend', (_source, transaction) => {
    const approval = transaction.data.startsWith(selectors.approve)
    const submittedHash = approval ? approvalHash : paymentHash
    assert.equal(transaction.chainId, chain)
    assert.equal(transaction.from, payer)
    assert.equal(transaction.value, '0x0')
    assert.equal(transaction.to.toLowerCase(), approval ? token : router)
    if (approval) {
      assert.equal(transaction.data, selectors.approve + addrWord(router).slice(2) + word(amount).slice(2))
    } else {
      assert.equal(transaction.data.slice(74), word(amount).slice(2))
      assert.notEqual(BigInt('0x' + transaction.data.slice(10, 74)), 0n)
    }
    sends.push(transaction)
    if (sends.length === 1) return { rejected: true }
    transactions.set(submittedHash, settlement(submittedHash, transaction))
    if (approval) {
      allowance = amount
      block = 101n
    }
    return { hash: submittedHash }
  })
  await context.addInitScript(({ payer, chain }) => {
    window.vexWalletCalls = []
    window.vexDraws = 0
    const draw = WebGL2RenderingContext.prototype.drawElements
    WebGL2RenderingContext.prototype.drawElements = function (...args) {
      window.vexDraws++
      return draw.apply(this, args)
    }
    window.ethereum = {
      async request({ method, params }) {
        window.vexWalletCalls.push(method)
        if (method === 'eth_chainId') return chain
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [payer]
        if (method === 'eth_sendTransaction') {
          const reserved = JSON.parse(localStorage.getItem('vextride.arc.router.v1.5042.' + payer))
          if (reserved?.status !== 'awaiting') throw new Error('Wallet call preceded durable reservation')
          const response = await window.mockVextrideSend(params[0])
          if (response.rejected) throw Object.assign(new Error('Mock wallet declined'), { code: 4001 })
          return response.hash
        }
        throw new Error('Unexpected wallet method: ' + method)
      },
      on() {},
      removeListener() {},
    }
  }, { payer, chain })
  await context.route('https://rpc.mainnet.arc.io/**', async route => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const { method, params, id } = route.request().postDataJSON()
    assert.ok(!/send|sign/i.test(method), `Network attempted a write: ${method}`)
    const result = rpcResult(method, params)
    await route.fulfill({ status: 200, headers: cors, json: { jsonrpc: '2.0', id, result } })
  })

  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  page.on('pageerror', error => reportedErrors.push(error.message))
  page.on('console', message => {
    const text = message.text()
    if (/shader error|violates the following.*policy|failed to compile/i.test(text)) reportedErrors.push(text)
  })
  page.on('response', response => {
    if (response.url().startsWith(server.url.href + 'assets/') && response.ok()) assets.add(response.url())
  })
  const nested = await page.goto(new URL('/qa/nested', server.url).href)
  assert.equal(nested.status(), 200)
  assert.equal(nested.headers()['content-security-policy'], headers.get('content-security-policy'))
  assert.ok(await page.evaluate(() => isSecureContext && !!navigator.locks))
  const creator = page.getByRole('dialog', { name: 'Create Your Character' })
  await creator.getByRole('textbox', { name: 'Name' }).fill('Router QA')
  await button(creator, 'Start Playing').click()
  await page.waitForFunction(() => window.vexDraws > 0)
  await button(page, 'Arc Wallet').waitFor()
  assert.equal(await page.evaluate(() => window.vexWalletCalls.length), 0)
  assert.ok(![...assets].some(url => url.includes('ArcWalletContent')))

  async function openWallet() {
    await button(page, 'Arc Wallet').click()
    const wallet = page.getByRole('dialog', { name: 'Arc Wallet' })
    await button(wallet, 'Connect Wallet').click()
    await wallet.getByText('Connected to Arc Mainnet').waitFor()
    assert.ok(await wallet.getByRole('region', { name: 'Send USDC' }).isVisible())
    await button(wallet, 'Fixed-recipient router').click()
    return wallet
  }

  let wallet = await openWallet()
  assert.ok([...assets].some(url => url.includes('ArcWalletContent')))
  await wallet.getByRole('textbox', { name: 'Router payment amount in USDC' }).fill('1.234567')
  available = 10n
  await button(wallet, 'Review Router Payment').click()
  await wallet.getByText('Insufficient USDC for this amount.', { exact: true }).waitFor()
  available = 10_000_000n
  nativeBalance = amount * 10n ** 12n
  await button(wallet, 'Review Router Payment').click()
  await wallet.getByText(/cover the network fee/).waitFor()
  nativeBalance = 10n ** 19n
  assert.equal(sends.length, 0)
  const reviewApproval = async () => {
    await wallet.getByRole('textbox', { name: 'Router payment amount in USDC' }).fill('1.234567')
    await button(wallet, 'Review Router Payment').click()
    await wallet.getByRole('heading', { name: 'Review exact USDC allowance' }).waitFor()
  }

  await reviewApproval()
  assert.equal(sends.length, 0)
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Review exact USDC allowance')
  await page.keyboard.press('Escape')
  assert.ok(await wallet.isVisible())
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Review Router Payment')
  await reviewApproval()
  await button(wallet, 'Request Exact Allowance').click()
  await wallet.getByText('Wallet request declined.', { exact: true }).waitFor()
  assert.equal(sends.length, 1)
  await reviewApproval()
  await button(wallet, 'Request Exact Allowance').click()
  await wallet.getByText('Allowance approved · Payment still requires confirmation', { exact: true }).waitFor()
  assert.equal(sends.length, 2)
  const approvedReferenceText = await wallet.getByText(/^Reference 0x/).textContent()

  await page.reload()
  await button(page, 'Arc Wallet').waitFor()
  assert.equal(await page.evaluate(() => window.vexWalletCalls.length), 0)
  wallet = await openWallet()
  await wallet.getByText(/^Saved status: Allowance approved/).waitFor()
  assert.equal(await wallet.getByText(/^Reference 0x/).textContent(), approvedReferenceText)
  assert.equal(sends.length, 2)
  await button(wallet, 'Review Approved Payment').click()
  await wallet.getByRole('heading', { name: 'Review payment settlement' }).waitFor()
  assert.equal(sends.length, 2)
  await button(wallet, 'Request Wallet Payment').click()
  await wallet.getByText('Awaiting a matching receipt. Check again later.').waitFor()
  assert.equal(sends.length, 3)
  assert.equal('Reference 0x' + sends[2].data.slice(10, 74), approvedReferenceText)
  assert.ok(await wallet.getByText('Pending verification').isVisible())

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.reload()
  await button(page, 'Arc Wallet').waitFor()
  wallet = await openWallet()
  assert.ok(await wallet.getByText('Pending verification').isVisible())
  payMined = true
  await button(wallet, 'Recheck Router Status').click()
  await wallet.getByText('Payment confirmed on Arc', { exact: true }).waitFor()
  assert.equal(sends.length, 3)
  assert.equal(await wallet.getByRole('link', { name: /^Transaction/ }).getAttribute('href'),
    `https://explorer.arc.io/tx/${paymentHash}`)
  assert.ok(await wallet.evaluate(element => element.scrollWidth <= element.clientWidth + 1))
  await button(wallet, 'Close').click()
  assert.ok(await page.getByTestId('street-cash').isVisible())
  assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), 'Arc Wallet')
  assert.deepEqual(reportedErrors, [])
  console.log(JSON.stringify({
    browser: browser.version(), viewports: ['390x844', '1280x720'], renderer: 'SwiftShader',
    productionAssets: assets.size, mockedWalletRequests: sends.length, publicMethods: [...publicMethods], reportedErrors,
  }))
} finally {
  await browser.close()
  await server.stop(true)
}
