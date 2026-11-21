import assert from 'node:assert/strict'
import { custom, http, zeroAddress } from 'viem'
import { ARC_MAINNET, parseChainId } from '../src/game/blockchain/arcConfig'
import { createArcBalanceReader, formatUsdc } from '../src/game/blockchain/usdcBalance'
import { createWalletSession } from '../src/game/blockchain/walletSession'
import type { WalletProvider } from '../src/game/blockchain/walletProvider'
import { MISSION_REWARDS, STREET_CASH } from '../src/game/economy/economyConfig'
import { useMissionStore } from '../src/game/missions/missionState'

type Method = Parameters<WalletProvider['request']>[0]['method']
type Event = Parameters<WalletProvider['on']>[0]

const secondAddress = '0x1111111111111111111111111111111111111111'
const pass = (name: string) => console.log('PASS ', name)
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

class MockWallet implements WalletProvider {
  accounts = [zeroAddress as string]
  chainId = ARC_MAINNET.chainIdHex as string
  failConnect: number | null = null
  failSwitch: number | null = null
  methods: Method[] = []
  listeners = new Map<Event, Set<() => void>>()

  request({ method, params }: Parameters<WalletProvider['request']>[0]) {
    this.methods.push(method)
    switch (method) {
      case 'eth_requestAccounts':
        if (this.failConnect) return Promise.reject(Object.assign(new Error('Connect failed'), { code: this.failConnect }))
        return Promise.resolve(this.accounts)
      case 'eth_accounts':
        return Promise.resolve(this.accounts)
      case 'eth_chainId':
        return Promise.resolve(this.chainId)
      case 'wallet_switchEthereumChain':
        assert.equal(params?.[0].chainId, ARC_MAINNET.chainIdHex)
        if (this.failSwitch) return Promise.reject(Object.assign(new Error('Switch failed'), { code: this.failSwitch }))
        this.chainId = ARC_MAINNET.chainIdHex
        return Promise.resolve(null)
      default:
        throw new Error('Unexpected wallet method')
    }
  }

  on(event: Event, listener: () => void) {
    const handlers = this.listeners.get(event) ?? new Set()
    handlers.add(listener)
    this.listeners.set(event, handlers)
  }

  removeListener(event: Event, listener: () => void) {
    this.listeners.get(event)?.delete(listener)
  }

  emit(event: Event) {
    for (const listener of this.listeners.get(event) ?? []) listener()
  }

  count() {
    return [...this.listeners.values()].reduce((sum, handlers) => sum + handlers.size, 0)
  }
}

assert.equal(ARC_MAINNET.chain.id, 5042)
assert.equal(parseChainId('0x13B2'), 5042)
assert.equal(parseChainId('0x13b2junk'), null)
assert.equal(ARC_MAINNET.chain.nativeCurrency.decimals, 18)
assert.equal(ARC_MAINNET.chain.nativeCurrency.symbol, 'USDC')
assert.equal(ARC_MAINNET.chain.blockExplorers.default.url, 'https://explorer.arc.io')
assert.equal(ARC_MAINNET.rpcUrl, 'https://rpc.mainnet.arc.io')
assert.equal(ARC_MAINNET.usdcAddress, '0x3600000000000000000000000000000000000000')
assert.equal(formatUsdc(12345678901234567890123456n), '12345678901234567890.123456')
assert.equal(formatUsdc(1n), '0.000001')
assert.equal(formatUsdc(0n), '0')
pass('Arc Mainnet, verified token address, separate native precision and exact ERC-20 formatting')

const rpcMethods: string[] = []
let rpcChain = '0x13b2'
const read = createArcBalanceReader(custom({
  request({ method, params }: { method: string; params?: unknown }) {
    rpcMethods.push(method)
    if (method === 'eth_chainId') return Promise.resolve(rpcChain)
    assert.equal(method, 'eth_call')
    assert.deepEqual(params, [{
      to: ARC_MAINNET.usdcAddress,
      data: '0x70a08231' + '0'.repeat(24) + secondAddress.slice(2),
    }, 'latest'])
    return Promise.resolve('0x' + '0'.repeat(64))
  },
}, { retryCount: 0 }))
assert.equal(await read(secondAddress), 0n)
await assert.rejects(read('bad'))
rpcChain = '0x4cef52'
await assert.rejects(read(secondAddress))
assert.deepEqual(rpcMethods, ['eth_chainId', 'eth_call', 'eth_chainId'])
pass('Reader verifies exact chain and address, calls only ERC-20 balanceOf, and accepts real zero')

let transportAborted = false
const unreachable = createArcBalanceReader(http('https://wallet-test.invalid', {
  timeout: 20,
  retryCount: 0,
  fetchFn: (_url, init) => new Promise((_, reject) => {
    const abort = () => {
      transportAborted = true
      reject(new Error('aborted'))
    }
    if (init?.signal?.aborted) abort()
    else init?.signal?.addEventListener('abort', abort, { once: true })
  }),
}))
await assert.rejects(unreachable(secondAddress))
assert.ok(transportAborted)
pass('HTTP timeout rejects instead of producing a fabricated balance')

const core = useMissionStore.getState()
const wallet = new MockWallet()
wallet.chainId = '0x4cef52'
let reads = 0
let resolveBalance: (amount: bigint) => void = () => {}
let failRead = false
const session = createWalletSession(async () => {
  reads++
  if (failRead) throw new Error('RPC unavailable')
  return new Promise<bigint>(resolve => { resolveBalance = resolve })
})
assert.equal(session.store.getState().connection, 'disconnected')
assert.deepEqual(wallet.methods, [])
await session.connect(null)
assert.equal(session.store.getState().connection, 'missing')
wallet.failConnect = 4001
await session.connect(wallet)
assert.equal(session.store.getState().connection, 'rejected')
assert.equal(wallet.count(), 0)
wallet.failConnect = 4100
await session.connect(wallet)
assert.equal(session.store.getState().connection, 'error')
wallet.failConnect = null
pass('Guest startup causes no wallet calls, and missing, rejected and failed connections are distinct')

await Promise.all([session.connect(wallet), session.connect(wallet)])
assert.equal(wallet.methods.filter(method => method === 'eth_requestAccounts').length, 3)
assert.equal(wallet.count(), 3)
assert.equal(session.store.getState().chainId, 5042002)
await session.refresh()
assert.equal(reads, 0)
for (const [code, message] of [[4001, 'declined'], [4902, 'Add Arc Mainnet'], [4200, 'could not switch']] as const) {
  wallet.failSwitch = code
  await session.switchNetwork()
  assert.match(session.store.getState().networkNotice, new RegExp(message))
  assert.equal(reads, 0)
}
wallet.failSwitch = null
await session.switchNetwork()
assert.equal(session.store.getState().chainId, 5042)
assert.equal(wallet.count(), 3)
assert.equal(reads, 1)
await session.refresh()
assert.equal(reads, 1)
pass('Explicit calls deduplicate prompts, reject Testnet balance reads, and handle switch refusal, unknown chain and unsupported wallets')

const resolveOld = resolveBalance
wallet.accounts = [secondAddress]
wallet.emit('accountsChanged')
assert.equal(session.store.getState().balance, null)
await tick()
assert.equal(session.store.getState().address, secondAddress)
resolveOld(999999n)
await tick()
assert.equal(session.store.getState().balance, null)
resolveBalance(0n)
await tick()
assert.equal(session.store.getState().balance, 0n)
assert.equal(session.store.getState().balanceStatus, 'ready')
failRead = true
await session.refresh()
assert.equal(session.store.getState().balanceStatus, 'unavailable')
assert.equal(session.store.getState().balance, null)
pass('Account changes ignore stale bigint results and RPC errors clear the balance')

failRead = false
void session.refresh()
const resolveBeforeChainChange = resolveBalance
wallet.chainId = '0x1'
wallet.emit('chainChanged')
resolveBeforeChainChange(42n)
await tick()
assert.equal(session.store.getState().chainId, 1)
assert.equal(session.store.getState().balance, null)
wallet.emit('disconnect')
assert.equal(session.store.getState().connection, 'disconnected')
assert.equal(wallet.count(), 0)
await session.connect(wallet)
assert.equal(wallet.count(), 3)
wallet.accounts = []
wallet.emit('accountsChanged')
await tick()
assert.equal(session.store.getState().connection, 'disconnected')
assert.equal(wallet.count(), 0)
wallet.accounts = [secondAddress]
await session.connect(wallet)
session.disconnect()
session.disconnect()
assert.equal(wallet.count(), 0)
pass('Chain changes invalidate pending reads, provider disconnect and remount remove every session listener')

assert.equal(useMissionStore.getState(), core)
assert.equal(core.economy.balance, 0)
assert.equal(STREET_CASH.resprayPrice, 125)
assert.equal(MISSION_REWARDS['first-contact'].amount, 150)
assert.equal(MISSION_REWARDS['motor-row-shakedown'].amount, 300)
assert.ok(wallet.methods.every(method => ['eth_requestAccounts', 'eth_accounts', 'eth_chainId', 'wallet_switchEthereumChain'].includes(method)))
pass('Wallet uses only connection, inspection and explicit switch methods, with no economy mutation')
