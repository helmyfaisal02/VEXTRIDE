import assert from 'node:assert/strict'
import {
  custom, encodeAbiParameters, encodeEventTopics, maxUint256, toHex,
  type Address, type Hash, type Hex, type Log, type Transaction, type TransactionReceipt,
} from 'viem'
import { ARC_MAINNET } from '../src/game/blockchain/arcConfig'
import { ROUTER, routerAbi, routerData, routerTarget, routerTokenAbi, type RouterIntent, type RouterStep } from '../src/game/blockchain/routerContract'
import { createRouterJournal, decodeRouterRecord, newPaymentReference, type RouterRecord } from '../src/game/blockchain/routerJournal'
import { createRouterRpc, verifyRouterEvidence, type RouterQuote } from '../src/game/blockchain/routerRpc'
import { createRouterSession } from '../src/game/blockchain/routerSession'
import { observeTransfer, type Verification } from '../src/game/blockchain/transferVerification'
import type { WalletProvider } from '../src/game/blockchain/walletProvider'

const hex32 = (byte: string): Hash => `0x${byte.repeat(32)}`
const sender = '0x1111111111111111111111111111111111111111'
const other = '0x2222222222222222222222222222222222222222'
const reference = hex32('ab')
const hash = hex32('10')
const alternative = hex32('20')
const blockHash = hex32('ff')
const intent: RouterIntent = { sender, reference, amount: 1_234_567n }
const word = (value: bigint) => encodeAbiParameters([{ type: 'uint256' }], [value])
const evidence: Verification = { status: 'confirmed', block: 101n, logIndex: 3 }

function records() {
  const values = new Map<string, string>()
  return { values, create: () => createRouterJournal(() => ({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
  })) }
}

function fixture(payer: Address = sender, chain = '0x13b2') {
  const persisted = records()
  const dispatched: Parameters<WalletProvider['request']>[0][] = []
  const reads: string[] = []
  let exclusive = Promise.resolve<unknown>(undefined)
  let generation = 0
  let currentAccount = payer
  let connected = true
  let quoteStep: RouterStep = 'approval'
  let fault: Error | undefined
  let quoteFee = 200n
  let outcome: Verification = evidence
  let reply: () => Promise<unknown> = () => Promise.resolve(hash)
  const wallet = {
    getTransferContext() {
      if (!connected) return null
      const epoch = generation
      const address = currentAccount
      const provider: WalletProvider = {
        async request(request) {
          if (request.method === 'eth_chainId') return chain
          if (request.method === 'eth_accounts') return [currentAccount]
          dispatched.push(request)
          const record = persisted.create().read(address)
          assert.ok(record && record.status === 'awaiting', 'intent must be durable before dispatch')
          assert.equal(request.method, 'eth_sendTransaction')
          if (request.method === 'eth_sendTransaction') {
            const transaction = request.params[0]
            assert.equal(transaction.data, routerData(record.step, { sender: address, reference, amount: intent.amount }))
            assert.equal(transaction.to, routerTarget(record.step))
            assert.equal(transaction.from, address)
            assert.equal(transaction.chainId, '0x13b2')
            assert.equal(transaction.value, '0x0')
            assert.equal(transaction.gas, toHex(10_000n))
            assert.equal(transaction.maxFeePerGas, toHex(quoteFee))
          }
          return reply()
        },
        on() {},
        removeListener() {},
      }
      return { address, provider, isCurrent: () => epoch === generation }
    },
    refresh: () => Promise.resolve(),
  }
  const rpc = {
    quote(proposal: RouterIntent, afterApproval: boolean): Promise<RouterQuote> {
      if (fault) return Promise.reject(fault)
      if (afterApproval) assert.equal(quoteStep, 'payment')
      return Promise.resolve({ intent: proposal, step: quoteStep, allowance: quoteStep === 'approval' ? 0n : intent.amount, feeCap: quoteFee,
        futurePaymentFee: quoteStep === 'approval' ? 500n : 0n, gas: 10_000n, maxFeePerGas: quoteFee, head: 100n })
    },
    verify(candidate: Hash) { reads.push(candidate); return Promise.resolve(outcome) },
  }
  function session(timeout?: number) {
    return createRouterSession(wallet, rpc, persisted.create(), action => {
      const next = exclusive.then(action)
      exclusive = next.catch(() => {})
      return next
    }, timeout, () => reference)
  }
  return {
    session, dispatched, persisted, reads,
    step: (step: RouterStep) => { quoteStep = step },
    reply: (handler: () => Promise<unknown>) => { reply = handler },
    fault: (error: Error) => { fault = error },
    fee: (fee: bigint) => { quoteFee = fee },
    outcome: (next: Verification) => { outcome = next },
    account: (address: Address) => { currentAccount = address; generation++ },
    disconnect: () => { connected = false; generation++ },
  }
}

async function review(session: ReturnType<typeof createRouterSession>, afterApproval = false) {
  await session.review('1.234567', afterApproval)
  const quote = session.store.getState().quote
  assert.ok(quote, session.store.getState().notice)
  return quote
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

async function group(name: string, test: () => void | Promise<void>) {
  await test()
  console.log(`PASS  ${name}`)
}

await group('Canonical router ABI encodes exact-amount approval and separate payment, with secure references', () => {
  assert.equal(routerData('approval', intent), `0x095ea7b3${ROUTER.address.slice(2).toLowerCase().padStart(64, '0')}${word(intent.amount).slice(2)}`)
  assert.equal(routerData('payment', intent), `0xd0ee4de0${reference.slice(2)}${word(intent.amount).slice(2)}`)
  const created = Array.from({ length: 32 }, newPaymentReference)
  assert.equal(new Set(created).size, created.length)
  assert.ok(created.every(value => /^0x[0-9a-f]{64}$/.test(value) && BigInt(value) !== 0n))
})

await group('Disconnected, wrong-chain, self-pay, exact amount precision and RPC failure never reach wallet handoff', async () => {
  const precise = fixture().session()
  for (const amount of ['1.2345678', '0', '-1', '1e2']) {
    await precise.review(amount)
    assert.equal(precise.store.getState().quote, null)
  }
  const wrong = fixture(sender, '0x1')
  const wrongSession = wrong.session()
  await wrongSession.review('1')
  assert.match(wrongSession.store.getState().notice, /network changed/)
  const self = fixture(ROUTER.recipient)
  const selfSession = self.session()
  await selfSession.review('1')
  assert.match(selfSession.store.getState().notice, /cannot pay itself/)
  const f = fixture()
  f.fault(new Error('offline'))
  const session = f.session()
  await session.review('1')
  assert.match(session.store.getState().notice, /Arc validation/)
  f.disconnect()
  await session.review('1')
  assert.match(session.store.getState().notice, /Connect a wallet/)
  assert.equal(f.dispatched.length, 0)
})

await group('Live adapter rejects a wrong public RPC chain and unexpected bytecode before reading a payer balance', async () => {
  for (const rightChain of [false, true]) {
    const calls: string[] = []
    const rpc = createRouterRpc(custom({
      request({ method, params }: { method: string; params?: unknown }) {
        calls.push(method)
        if (method === 'eth_chainId') return Promise.resolve(rightChain ? '0x13b2' : '0x1')
        if (method === 'eth_getCode') return Promise.resolve('0x6000')
        if (method === 'eth_call') {
          const call = (params as [{ data: Hex }])[0]
          return Promise.resolve(word(BigInt(call.data === '0x66d003ac' ? ROUTER.recipient : ARC_MAINNET.usdcAddress)))
        }
        return Promise.reject(new Error('Unexpected RPC call'))
      },
    }, { retryCount: 0 }))
    await assert.rejects(rpc.quote(intent, false), rightChain ? /deployed router/ : /RPC chain/)
    assert.ok(!calls.includes('eth_getBalance'))
  }
})

await group('Durable approval requires explicit form consent again before payment and keeps the same reference', async () => {
  const f = fixture()
  const session = f.session()
  const approval = await review(session)
  assert.equal(f.dispatched.length, 0)
  await session.confirm(approval)
  assert.equal(f.dispatched.length, 1)
  assert.equal(session.store.getState().record?.status, 'approved')

  const reloaded = f.session()
  reloaded.sync()
  assert.equal(reloaded.store.getState().verified, false)
  assert.equal(f.dispatched.length, 1)
  f.step('payment')
  f.reply(() => Promise.resolve(alternative))
  const payment = await review(reloaded, true)
  assert.equal(payment.intent.reference, reference)
  assert.equal(f.dispatched.length, 1)
  await reloaded.confirm(payment)
  assert.equal(f.dispatched.length, 2)
  assert.equal(reloaded.store.getState().record?.approvalHash, hash)
  assert.equal(reloaded.store.getState().record?.status, 'confirmed')
})

await group('Fee or allowance changes force a new review and stale confirmation controls are inert', async () => {
  const f = fixture()
  const session = f.session()
  const approval = await review(session)
  f.fee(300n)
  await session.confirm(approval)
  assert.equal(f.dispatched.length, 0)
  assert.match(session.store.getState().notice, /changed/)
  const fresh = session.store.getState().quote
  assert.ok(fresh)
  f.step('payment')
  await session.confirm(fresh)
  assert.equal(f.dispatched.length, 0)
  assert.equal(session.store.getState().quote?.step, 'payment')
  await session.confirm(fresh)
  assert.equal(f.dispatched.length, 0)
})

await group('Rapid duplicate clicks and simultaneous tabs share a compare-and-save journal reservation', async () => {
  const f = fixture()
  const first = f.session()
  const second = f.session()
  const [a, b] = await Promise.all([review(first), review(second)])
  await Promise.all([first.confirm(a), first.confirm(a), second.confirm(b)])
  assert.equal(f.dispatched.length, 1)
  assert.equal(f.persisted.create().read(sender)?.status, 'approved')
})

await group('Account changes during wallet handoff persist only to the original payer; no automatic send on reconnect', async () => {
  const f = fixture()
  const session = f.session()
  const request = deferred<unknown>()
  const accepted = deferred<void>()
  f.reply(() => { accepted.resolve(); return request.promise })
  const submission = session.confirm(await review(session))
  await accepted.promise
  f.account(other)
  session.invalidateWallet()
  request.resolve(hash)
  await submission
  assert.equal(session.store.getState().record, null)
  assert.equal(f.persisted.create().read(sender)?.hash, hash)
  assert.equal(f.persisted.create().read(other), null)
  f.account(sender)
  session.invalidateWallet()
  await session.refreshStatus()
  assert.equal(session.store.getState().record?.status, 'approved')
  assert.equal(f.dispatched.length, 1)
})

await group('Storage corruption, write failure and unauthorized sender records fail before wallet dispatch', async () => {
  const f = fixture()
  const session = f.session()
  const quote = await review(session)
  f.persisted.values.set(`vextride.arc.router.v1.5042.${sender}`, '{broken')
  await session.confirm(quote)
  assert.equal(f.dispatched.length, 0)
  assert.match(session.store.getState().notice, /storage failed/)
  const persisted = createRouterJournal(() => ({ getItem: () => null, setItem: () => { throw new Error('quota') } }))
  const reserved = {
    version: 1, chainId: 5042, router: ROUTER.address, sender, reference, amount: '1234567',
    step: 'payment', status: 'awaiting', head: '100', hash: null, approvalHash: null,
  } satisfies RouterRecord
  assert.throws(() => persisted.save(reserved, null), /quota/)
  for (const changed of [{ sender: other }, { chainId: 1 }, { status: 'pending' },
    { amount: maxUint256.toString() }, { amount: '1.2' }, { reference: hex32('00') }]) {
    assert.throws(() => decodeRouterRecord(JSON.stringify({ ...reserved, ...changed }), sender))
  }
})

await group('Rejected, timed-out and malformed wallet responses never retry, including after refresh', async () => {
  const declined = fixture()
  const session = declined.session()
  declined.reply(() => Promise.reject(Object.assign(new Error('Mock rejection'), { code: 4001 })))
  await session.confirm(await review(session))
  assert.equal(session.store.getState().record?.status, 'rejected')
  const f = fixture()
  const submitting = f.session(5)
  const request = deferred<unknown>()
  f.reply(() => request.promise)
  const inFlight = submitting.confirm(await review(submitting))
  await new Promise(resolve => setTimeout(resolve, 20))
  assert.equal(submitting.store.getState().awaitingWallet, false)
  assert.match(submitting.store.getState().notice, /unknown/)
  const refreshed = f.session()
  refreshed.sync()
  await refreshed.review('1.234567')
  assert.match(refreshed.store.getState().notice, /Resolve/)
  request.resolve('not a hash')
  await inFlight
  refreshed.sync()
  assert.equal(refreshed.store.getState().record?.status, 'unknown')
  assert.equal(f.dispatched.length, 1)
  assert.equal(f.reads.length, 0)
})

await group('Recovery requires a post-reservation match; alternate reverts never release an unresolved intent', async () => {
  const f = fixture()
  f.step('payment')
  f.outcome({ status: 'pending' })
  const first = f.session()
  await first.confirm(await review(first))
  assert.equal(first.store.getState().record?.status, 'pending')
  const next = f.session()
  next.sync()
  for (const invalid of [{ status: 'reverted', block: 101n }, { status: 'confirmed', block: 100n, logIndex: 3 }] as const) {
    f.outcome(invalid)
    await next.refreshStatus(alternative)
    assert.equal(next.store.getState().record?.status, 'pending')
    assert.equal(next.store.getState().record?.hash, hash)
  }
  f.outcome(evidence)
  await next.refreshStatus(alternative)
  assert.equal(next.store.getState().record?.status, 'confirmed')
  assert.equal(next.store.getState().record?.hash, alternative)
  assert.equal(f.dispatched.length, 1)
})

const mined = { blockHash, blockNumber: 101n, transactionIndex: 0, transactionHash: hash }
function movement(): Log<bigint, number, false> {
  const topics = encodeEventTopics({ abi: routerTokenAbi, eventName: 'Transfer', args: { from: sender, to: ROUTER.recipient } })
  return { ...mined, logIndex: 2, address: ARC_MAINNET.usdcAddress, data: word(intent.amount), topics: [topics[0], topics[1] as Hex, topics[2] as Hex], removed: false }
}
function settlement(): Log<bigint, number, false> {
  const topics = encodeEventTopics({ abi: routerAbi, eventName: 'PaymentSettled',
    args: { payer: sender, recipient: ROUTER.recipient, paymentReference: reference } })
  return { ...mined, logIndex: 3, address: ROUTER.address, data: word(intent.amount),
    topics: [topics[0], topics[1] as Hex, topics[2] as Hex, topics[3] as Hex], removed: false }
}
async function verify(step: RouterStep, logs: TransactionReceipt['logs'], tx: Partial<Transaction> = {}, rc: Partial<TransactionReceipt> = {}) {
  const to = routerTarget(step)
  const observation = await observeTransfer({
    getTransaction: () => Promise.resolve({ ...mined, from: sender, to, input: routerData(step, intent), value: 0n, hash,
      chainId: 5042, ...tx } as Transaction),
    getTransactionReceipt: () => Promise.resolve({ ...mined, from: sender, to, status: 'success', logs, ...rc } as TransactionReceipt),
  }, hash)
  return verifyRouterEvidence(observation, step, intent)
}

await group('Receipt verification binds chain and calldata to both exact settlement and canonical token evidence', async () => {
  const movementLog = movement()
  const settlementLog = settlement()
  const native: Log<bigint, number, false> = { ...movementLog, logIndex: 1,
    address: '0xfffffffffffffffffffffffffffffffffffffffe', data: word(intent.amount * 10n ** 12n) }
  assert.deepEqual(await verify('payment', [native, movementLog, settlementLog]), evidence)
  const invalidLogs: TransactionReceipt['logs'][] = [
    [native, settlementLog], [movementLog], [movementLog, settlementLog, settlementLog],
    [movementLog, { ...settlementLog, logIndex: 2 }],
    [{ ...movementLog, address: other }, settlementLog],
    [{ ...movementLog, data: word(intent.amount + 1n) }, settlementLog],
    [movementLog, { ...settlementLog, data: word(intent.amount + 1n) }],
    [movementLog, { ...settlementLog, topics: [settlementLog.topics[0]!, settlementLog.topics[1]!, settlementLog.topics[2]!, alternative] }],
    [movementLog, { ...settlementLog, removed: true }],
  ]
  for (const logs of invalidLogs) assert.equal((await verify('payment', logs)).status, 'unknown')
  const invalidTransactions: Partial<Transaction>[] = [{ chainId: 1 }, { from: other }, { value: 1n }, { hash: alternative },
    { input: routerData('payment', { ...intent, amount: 1n }) }]
  for (const tx of invalidTransactions) {
    assert.equal((await verify('payment', [movementLog, settlementLog], tx)).status, 'unknown')
  }
  assert.equal((await verify('payment', [movementLog, settlementLog], {}, { blockHash: alternative })).status, 'unknown')
  assert.equal((await verify('payment', [], {}, { status: 'reverted' })).status, 'reverted')
})

await group('Approval receipts require canonical spender, owner and exact allowance and never verify as payment', async () => {
  const topics = encodeEventTopics({ abi: routerTokenAbi, eventName: 'Approval', args: { owner: sender, spender: ROUTER.address } })
  const approval: Log<bigint, number, false> = { ...mined, logIndex: 3, address: ARC_MAINNET.usdcAddress,
    data: word(intent.amount), topics: [topics[0], topics[1] as Hex, topics[2] as Hex], removed: false }
  assert.deepEqual(await verify('approval', [approval]), evidence)
  assert.equal((await verify('payment', [approval])).status, 'unknown')
  assert.equal((await verify('approval', [{ ...approval, data: word(maxUint256) }])).status, 'unknown')
  assert.equal((await verify('approval', [{ ...approval, topics: [topics[0], topics[1] as Hex, word(1n)] }])).status, 'unknown')
})
