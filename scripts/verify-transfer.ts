import assert from 'node:assert/strict'
import { custom, encodeEventTopics, parseAbi, toHex, zeroAddress, type Hash } from 'viem'
import { ARC_MAINNET } from '../src/game/blockchain/arcConfig'
import { assertAffordable, usdcToNative, validateTransfer } from '../src/game/blockchain/transferValidation'
import { createTransferRpc, transferData, type TransferQuote } from '../src/game/blockchain/transferRpc'
import { createTransferSession } from '../src/game/blockchain/transferSession'
import { createWalletSession } from '../src/game/blockchain/walletSession'
import type { WalletProvider } from '../src/game/blockchain/walletProvider'
import { useMissionStore } from '../src/game/missions/missionState'

const sender = '0x1111111111111111111111111111111111111111'
const recipient = '0x2222222222222222222222222222222222222222'
const hash: Hash = `0x${'ab'.repeat(32)}`
const word = (n: bigint) => toHex(n, { size: 32 })
const intent = validateTransfer(sender, recipient, '1.234567')
const pass = (name: string) => console.log('PASS ', name)

assert.equal(intent.amount, 1234567n)
assert.equal(validateTransfer(sender, recipient, '0.000001').amount, 1n)
for (const amount of ['','NaN','Infinity','0','0.000000','-1','+1','1e6','1.0000001','1,25','1.','9'.repeat(81)]) {
  assert.throws(() => validateTransfer(sender, recipient, amount))
}
for (const address of ['',zeroAddress,ARC_MAINNET.usdcAddress,sender,'arctestnet:'+recipient,'alice.eth','0x1234']) {
  assert.throws(() => validateTransfer(sender, address, '1'))
}
pass('Recipient rules and exact six-decimal parsing reject unsafe input without rounding')
assert.equal(usdcToNative(1n), 10n ** 12n)
assert.throws(() => assertAffordable(10n, usdcToNative(10n), 10n, 1n), /fee/)
assert.throws(() => assertAffordable(9n, usdcToNative(11n), 10n, 1n), /Insufficient/)
assertAffordable(10n, usdcToNative(10n)+1n, 10n, 1n)
pass('Affordability compares one balance against amount plus gas without double counting')

const eventAbi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])
const log = {
  address: ARC_MAINNET.usdcAddress, topics: encodeEventTopics({abi:eventAbi,eventName:'Transfer',args:{from:sender,to:recipient}}),
  data: word(intent.amount), removed:false,
}
let chain = '0x13b2', simulation = 1n, balance = 10_000_000n, gasPrice = 19_000_000_000n
let receipt: object | null = null
const rpcCalls: string[] = []
const rpc = createTransferRpc(custom({
  request({method, params}: {method:string;params?:unknown}) {
    rpcCalls.push(method)
    switch (method) {
      case 'eth_chainId': return Promise.resolve(chain)
      case 'eth_getBalance': return Promise.resolve(toHex(usdcToNative(balance)))
      case 'eth_estimateGas': return Promise.resolve(toHex(50_000n))
      case 'eth_gasPrice': return Promise.resolve(toHex(gasPrice))
      case 'eth_getTransactionReceipt': return Promise.resolve(receipt)
      case 'eth_call': {
        assert.ok(Array.isArray(params))
        const call: unknown = params[0]
        assert.ok(call && typeof call === 'object' && 'data' in call)
        return Promise.resolve(call.data === transferData(intent) ? word(simulation) : word(balance))
      }
      default: return Promise.reject(new Error('Unexpected method'))
    }
  },
}, {retryCount:0}))
const initialQuote = await rpc.quote(intent)
assert.equal(initialQuote.gas, 60_000n)
assert.equal(initialQuote.maxFeePerGas, 20_000_000_000n)
assert.equal(initialQuote.fee, 1_200_000_000_000_000n)
balance = intent.amount
await assert.rejects(rpc.quote(intent), /fee/)
balance = 10_000_000n
simulation = 0n
await assert.rejects(rpc.quote(intent), /simulate/)
simulation = 1n
chain = '0x1'
await assert.rejects(rpc.quote(intent), /chain/)
chain = '0x13b2'
pass('Real Viem preflight checks simulation, gas margin, fee floor, wrong RPC chain and insufficient gas')

assert.equal(await rpc.receipt(hash, intent), 'pending')
const validReceipt = {transactionHash:hash, from:sender, to:ARC_MAINNET.usdcAddress, blockHash:hash, blockNumber:'0x10', status:'0x1',logs:[log]}
receipt = validReceipt
assert.equal(await rpc.receipt(hash, intent), 'confirmed')
receipt = {...validReceipt,logs:[{...log,data:word(42n)}]}
assert.equal(await rpc.receipt(hash,intent),'unknown')
receipt = {...validReceipt,status:'0x0',logs:[]}
assert.equal(await rpc.receipt(hash, intent), 'reverted')
receipt = {...validReceipt,transactionHash:word(3n)}
assert.equal(await rpc.receipt(hash,intent),'unknown')
pass('Receipt checks require matching hash, chain, sender, contract, outcome and exact Transfer log')

type Args = Parameters<WalletProvider['request']>[0]
let walletChain = '0x1', account = sender as string, sends = 0
let settle: (value: unknown) => void = () => {}
let reject: (error: Error) => void = () => {}
const sent: Args[] = []
const provider: WalletProvider = {
  on: () => {},
  removeListener: () => {},
  request(args) {
    switch (args.method) {
      case 'eth_chainId': return Promise.resolve(walletChain)
      case 'eth_accounts':
      case 'eth_requestAccounts': return Promise.resolve([account])
      case 'eth_sendTransaction':
        sends++
        sent.push(args)
        return new Promise((resolve,fail) => { settle = resolve; reject = fail })
      default: return Promise.reject(new Error('Unexpected wallet method'))
    }
  },
}
const gameBefore = useMissionStore.getState()
const wallet = createWalletSession(() => Promise.resolve(10000000n))
let fee = initialQuote.fee
let receiptError = false
const session = createTransferSession(wallet,{
  quote: () => Promise.resolve({...initialQuote, fee}),
  receipt: () => receiptError ? Promise.reject(new Error('timeout')) : Promise.resolve('pending'),
}, 100)
const state = session.store.getState
const proposal = (): TransferQuote => {
  const quote = state().quote
  assert.ok(quote)
  return quote
}
const until = async (predicate:() => boolean) => {
  for (let i=0;i<200&&!predicate();i++) await new Promise(resolve=>setTimeout(resolve,1))
  assert.ok(predicate())
}
await session.review(recipient,'1.234567')
assert.equal(state().status,'rpc-error')
await wallet.connect(provider)
await session.review(recipient,'1.234567')
assert.equal(state().quote,null)
assert.equal(sends,0)
wallet.disconnect()
walletChain = '0x13b2'
await wallet.connect(provider)
await session.review(recipient,'1.234567')
let q = proposal()
account = recipient
await session.confirm(q)
assert.equal(sends,0)
account = sender
await session.review(recipient,'1.234567')
q = proposal()
session.clearDraft()
await session.confirm(q)
assert.equal(sends,0)
pass('Disconnected, wrong chain, changed account and cancelled review cannot reach wallet submission')

await session.review(recipient,'1.234567')
q = proposal()
fee++
await session.confirm(q)
assert.equal(state().status,'review')
assert.equal(sends,0)
await session.confirm(q)
assert.equal(sends,0)
let request = session.confirm(proposal())
await until(()=>sends===1)
await session.confirm(q)
assert.equal(sends,1)
reject(Object.assign(new Error('declined'),{code:4001}))
await request
assert.equal(state().status,'rejected')
assert.equal(sends,1)
pass('Fee increase requires fresh review, double confirm cannot send twice, and rejection never retries')

await session.review(recipient,'1.234567')
request = session.confirm(proposal())
await until(()=>sends===2)
wallet.disconnect()
session.invalidateWallet()
await until(()=>state().status==='unknown')
assert.equal(session.locked(),true)
await session.review(recipient,'1.234567')
assert.equal(sends,2)
settle(hash)
await request
await until(()=>state().status==='pending')
assert.equal(state().hash,hash)
receiptError = true
await session.refreshStatus()
assert.equal(state().status,'rpc-error')
assert.equal(session.locked(),true)
assert.equal(sends,2)
const call = sent[sent.length - 1]
assert.equal(call?.method,'eth_sendTransaction')
assert.deepEqual(call?.params?.[0],{
  chainId:'0x13b2',from:sender,to:ARC_MAINNET.usdcAddress,data:transferData(intent),value:'0x0',type:'0x2',
  gas:toHex(initialQuote.gas),maxFeePerGas:toHex(initialQuote.maxFeePerGas),maxPriorityFeePerGas:'0x0',
})
assert.ok(rpcCalls.every(method => ['eth_chainId','eth_getBalance','eth_estimateGas','eth_gasPrice','eth_getTransactionReceipt','eth_call'].includes(method)))
assert.equal(useMissionStore.getState(),gameBefore)
pass('Timeout keeps duplicate lock, a late hash tracks across disconnect, and only direct USDC calldata is submitted')
