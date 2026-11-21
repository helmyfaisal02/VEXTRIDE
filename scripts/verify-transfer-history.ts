import assert from 'node:assert/strict'
import { custom, encodeEventTopics, parseAbi, toHex, type Address, type Hash } from 'viem'
import { ARC_MAINNET } from '../src/game/blockchain/arcConfig'
import { createTransferHistory, decodeTransferHistory, forAccount, TRANSFER_KEY } from '../src/game/blockchain/transferHistory'
import { createTransferRpc, transferData, type TransferQuote } from '../src/game/blockchain/transferRpc'
import { createTransferSession } from '../src/game/blockchain/transferSession'
import { validateTransfer } from '../src/game/blockchain/transferValidation'
import { createWalletSession } from '../src/game/blockchain/walletSession'
import type { WalletProvider } from '../src/game/blockchain/walletProvider'

const sender = '0x1111111111111111111111111111111111111111'
const recipient = '0x2222222222222222222222222222222222222222'
const other = '0x3333333333333333333333333333333333333333'
const hash: Hash = `0x${'ad'.repeat(32)}`
const blockHash: Hash = `0x${'21'.repeat(32)}`
const intent = validateTransfer(sender, recipient, '1.234567')
const pass = (label: string) => console.log('PASS ', label)
const word = (n: bigint) => toHex(n, { size: 32 })
const token = ARC_MAINNET.usdcAddress
const abi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])
const mined = { blockHash, blockNumber: '0x11', transactionIndex: '0x2' }
const tx = { ...mined, hash, from: sender, to: token, input: transferData(intent), value: '0x0', chainId: '0x13b2' }
const log = {
  ...mined, transactionHash: hash, logIndex: '0x3', address: token, removed: false, data: word(intent.amount),
  topics: encodeEventTopics({abi,eventName:'Transfer',args:{from:sender,to:recipient}}),
}
const receipt = { ...mined, transactionHash:hash, from:sender, to:token, status:'0x1', logs:[log] }
let currentTx: object | null = tx
let currentReceipt: object | null = receipt
let chainId = '0x13b2'
let rpcUnavailable = false
const methods: string[] = []
const rpc = createTransferRpc(custom({
  request({method}:{method:string}) {
    methods.push(method)
    if (rpcUnavailable) return Promise.reject(new Error('offline'))
    if (method === 'eth_chainId') return Promise.resolve(chainId)
    if (method === 'eth_getTransactionByHash') return Promise.resolve(currentTx)
    if (method === 'eth_getTransactionReceipt') return Promise.resolve(currentReceipt)
    return Promise.reject(new Error('Unexpected RPC method'))
  },
}, {retryCount:0}))
assert.deepEqual(await rpc.verify(hash,intent),{status:'confirmed',block:17n,logIndex:3})
currentReceipt = {...receipt, logs:[log,log,{...log,address:other}]}
assert.equal(await rpc.receipt(hash,intent),'confirmed')
currentReceipt = {...receipt, logs:[log,{...log,logIndex:'0x4'}]}
assert.equal(await rpc.receipt(hash,intent),'unknown')
currentReceipt = {...receipt, logs:[log,{...log,data:word(1n)}]}
assert.equal(await rpc.receipt(hash,intent),'unknown')
for (const changed of [{...log,address:other}, {...log,transactionHash:word(2n)}, {...log,blockHash:word(3n)},
  {...log,data:word(1n)}, {...log,topics:encodeEventTopics({abi,eventName:'Transfer',args:{from:sender,to:other}})}]) {
  currentReceipt = {...receipt,logs:[changed]}
  assert.equal(await rpc.receipt(hash,intent),'unknown')
}
pass('ARC ERC-20 evidence deduplicates identical log indexes and rejects ambiguity, wrong emitter, block, recipient or amount')
currentReceipt = receipt
for (const altered of [{...tx,hash:word(1n)}, {...tx,from:other}, {...tx,input:transferData({...intent,recipient:other})},
  {...tx,input:transferData({...intent,amount:2n})}, {...tx,to:other}, {...tx,chainId:'0x1'}, {...tx,value:'0x1'}]) {
  currentTx = altered
  assert.equal(await rpc.receipt(hash,intent),'unknown')
}
currentTx = tx
currentReceipt = null
assert.equal(await rpc.receipt(hash,intent),'pending')
currentReceipt = {...receipt,status:'0x0',logs:[]}
assert.deepEqual(await rpc.verify(hash,intent),{status:'reverted',block:17n})
chainId = '0x1'
await assert.rejects(rpc.inspect(hash))
chainId = '0x13b2'
rpcUnavailable = true
await assert.rejects(rpc.inspect(hash))
rpcUnavailable = false
currentReceipt = receipt
assert.equal((await rpc.inspect(hash)).status,'confirmed')
assert.ok(methods.every(method=>['eth_chainId','eth_getTransactionByHash','eth_getTransactionReceipt'].includes(method)))
pass('Exact transaction input, sender, chain and hash reject replacement mismatch; public inspection uses reads only')

let raw: string | null = null
let failWrites = false
const storage = () => ({
  getItem: (key:string) => { assert.equal(key,TRANSFER_KEY);return raw },
  setItem: (key:string,value:string) => { assert.equal(key,TRANSFER_KEY); if (failWrites) throw new Error('quota');raw=value },
})
const journal = createTransferHistory(storage,()=>10000)
let reserved = journal.begin(intent,16n)
assert.equal(reserved.hash,null)
assert.throws(()=>journal.begin(intent,16n),/Resolve/)
const first = journal.update(reserved.id,{status:'submitted',hash})
assert.ok(first)
const reopened = createTransferHistory(storage,()=>20000)
reopened.sync()
assert.deepEqual(reopened.store.getState().records,[first])
assert.equal(forAccount(reopened.store.getState().records,other).length,0)
assert.equal(forAccount([{...first,chainId:1}],sender).length,0)
const second = reopened.begin({...intent,sender:other},16n)
assert.equal(reopened.update(second.id,{status:'submitted',hash}),null)
for (const invalid of ['{bad',JSON.stringify({version:2,records:[]}),...[
  {...first,chainId:1}, {...first,amount:'NaN'}, {...first,recipient:sender}, {...first,hash:'0x1'},
  {...first,status:'confirmed',checkedAt:10001,block:'16',logIndex:0},
].map(record=>JSON.stringify({version:1,records:[record]}))]) {
  assert.throws(()=>decodeTransferHistory(invalid))
}
assert.throws(()=>decodeTransferHistory(JSON.stringify({version:1,records:[first,{...first,id:second.id,sender:other}]})))
pass('Reload restores valid records, isolates sender and chain and refuses corrupt, contradictory or duplicate records')

let account:Address = sender, providerChain = '0x13b2', sends = 0
const provider: WalletProvider = {
  on:()=>{},removeListener:()=>{},
  request({method}) {
    if (method === 'eth_chainId') return Promise.resolve(providerChain)
    if (method === 'eth_accounts' || method === 'eth_requestAccounts') return Promise.resolve([account])
    if (method === 'eth_sendTransaction') sends++
    return Promise.reject(new Error('No transaction method expected'))
  },
}
const wallet = createWalletSession(()=>Promise.resolve(0n))
const quote: TransferQuote = { intent, available:10000000n, gas:10n, maxFeePerGas:20n, fee:200n, head:16n }
const deps = { quote:()=>Promise.resolve(quote), verify:rpc.verify }
const recovered = createTransferSession(wallet,deps,100,reopened)
assert.equal(await recovered.refreshStatus(first.id),false)
await wallet.connect(provider)
assert.equal(recovered.locked(),true)
await recovered.review(recipient,'1.234567')
assert.equal(recovered.store.getState().quote,null)
await recovered.refreshStatus(first.id)
assert.equal(reopened.store.getState().records[0].status,'confirmed')
assert.equal(reopened.store.getState().records[0].logIndex,3)
assert.equal(sends,0)
wallet.disconnect()
account = other
await wallet.connect(provider)
assert.equal(await recovered.refreshStatus(first.id),false)
assert.equal(recovered.locked(),true)
pass('Reconnect only checks its own known hash and never retries a pending send')

wallet.disconnect()
account = sender
await wallet.connect(provider)
reserved = reopened.begin(intent,16n)
assert.equal(recovered.locked(),true)
assert.equal(await recovered.refreshStatus(reserved.id,hash),false) // already used by another record
assert.equal(sends,0)
const freshHash = word(8n)
currentTx = {...tx,hash:freshHash}
currentReceipt = {...receipt,transactionHash:freshHash,logs:[{...log,transactionHash:freshHash}]}
currentReceipt = {...receipt,transactionHash:freshHash,blockNumber:"0x10",logs:[{...log,transactionHash:freshHash,blockNumber:"0x10"}]}
currentTx = {...tx,hash:freshHash,blockNumber:"0x10"}
assert.equal(await recovered.refreshStatus(reserved.id,freshHash),false)
currentReceipt = {...receipt,transactionHash:freshHash,logs:[{...log,transactionHash:freshHash}]}
currentTx = {...tx,hash:freshHash}
assert.equal(await recovered.refreshStatus(reserved.id,freshHash),true)
assert.equal(reopened.store.getState().records.find(item=>item.id===reserved.id)?.hash,freshHash)
pass('Hashless recovery uses exact mined intent after its block anchor and never reuses a history hash')

failWrites = true
await recovered.review(recipient,'1.234567')
const reviewed = recovered.store.getState().quote
assert.ok(reviewed)
await recovered.confirm(reviewed)
assert.equal(sends,0)
assert.equal(recovered.store.getState().status,'rpc-error')
failWrites = false
providerChain = '0x1'
wallet.disconnect()
await wallet.connect(provider)
assert.equal(await recovered.refreshStatus(reserved.id),false)
pass('Quota failure blocks wallet handoff and wrong-network reconnect pauses history checks')
