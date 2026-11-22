import {
  decodeEventLog, parseAbi, TransactionNotFoundError, TransactionReceiptNotFoundError,
  type Address, type Hash, type Transaction, type TransactionReceipt,
} from 'viem'
import { ARC_MAINNET } from './arcConfig'
import { isTransactionHash, type TransferIntent } from './transferValidation'

const abi = parseAbi(['event Transfer(address indexed from, address indexed to, uint256 value)'])
const token = ARC_MAINNET.usdcAddress
const sameHex = (a: string | null | undefined, b: string) => a?.toLowerCase() === b.toLowerCase()

export interface ObservedMovement {
  sender: Address
  recipient: Address
  amount: bigint
  logIndex: number
}

export type Observation =
  | { status: 'pending' | 'unknown' }
  | { status: 'confirmed' | 'reverted'; block: bigint; sender: Address; to: Address | null; movements: ObservedMovement[]; transaction: Transaction; receipt: TransactionReceipt }

export type Verification =
  | { status: 'pending' | 'unknown' }
  | { status: 'reverted'; block: bigint }
  | { status: 'confirmed'; block: bigint; logIndex: number }

function movements(receipt: TransactionReceipt) {
  const byIndex = new Map<number, ObservedMovement>()
  for (const log of receipt.logs) {
    if (!sameHex(log.address, token) || !sameHex(log.topics[0], transferTopic)) continue
    if (log.removed || !sameHex(log.transactionHash, receipt.transactionHash) ||
        !sameHex(log.blockHash, receipt.blockHash) || log.blockNumber !== receipt.blockNumber ||
        log.transactionIndex !== receipt.transactionIndex || !Number.isSafeInteger(log.logIndex) || log.logIndex < 0) return null
    try {
      const event = decodeEventLog({ abi, eventName: 'Transfer', data: log.data, topics: log.topics })
      const movement = { sender: event.args.from, recipient: event.args.to, amount: event.args.value, logIndex: log.logIndex }
      const existing = byIndex.get(log.logIndex)
      if (existing && (!sameHex(existing.sender, movement.sender) ||
          !sameHex(existing.recipient, movement.recipient) || existing.amount !== movement.amount)) return null
      byIndex.set(log.logIndex, movement)
    } catch {
      return null
    }
  }
  return [...byIndex.values()]
}

const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export async function observeTransfer(
  client: {
    getTransaction(args: { hash: Hash }): Promise<Transaction>
    getTransactionReceipt(args: { hash: Hash }): Promise<TransactionReceipt>
  },
  hash: Hash,
): Promise<Observation> {
  if (!isTransactionHash(hash)) throw new Error('Invalid transaction hash')
  const [transaction, receipt] = await Promise.all([
    client.getTransaction({ hash }).catch(error => {
      if (error instanceof TransactionNotFoundError) return null
      throw error
    }),
    client.getTransactionReceipt({ hash }).catch(error => {
      if (error instanceof TransactionReceiptNotFoundError) return null
      throw error
    }),
  ])
  if (transaction && !sameHex(transaction.hash, hash)) return { status: 'unknown' }
  if (!receipt) return { status: 'pending' }
  if (!transaction || !sameHex(receipt.transactionHash, hash) ||
      !transaction.blockHash || !isTransactionHash(receipt.blockHash) ||
      !sameHex(transaction.blockHash, receipt.blockHash) ||
      transaction.blockNumber === null || transaction.blockNumber !== receipt.blockNumber ||
      transaction.transactionIndex === null || transaction.transactionIndex !== receipt.transactionIndex ||
      !sameHex(transaction.from, receipt.from) ||
      (receipt.to === null ? transaction.to !== null : !sameHex(transaction.to, receipt.to)) ||
      (transaction.chainId !== undefined && transaction.chainId !== ARC_MAINNET.chain.id) ||
      (receipt.status !== 'success' && receipt.status !== 'reverted')) return { status: 'unknown' }

  const observed = receipt.status === 'success' ? movements(receipt) : []
  if (!observed) return { status: 'unknown' }
  return {
    status: receipt.status === 'success' ? 'confirmed' : 'reverted',
    block: receipt.blockNumber, sender: transaction.from, to: transaction.to,
    movements: observed, transaction, receipt,
  }
}

export function verifyIntent(observation: Observation, intent: TransferIntent, expectedData: string): Verification {
  if (!('transaction' in observation)) return { status: observation.status }
  const { transaction, block, status } = observation
  if (!sameHex(transaction.from, intent.sender) || !sameHex(transaction.to, token) ||
      !sameHex(transaction.input, expectedData) || transaction.value !== 0n) return { status: 'unknown' }
  if (status === 'reverted') return { status, block }
  const matches = observation.movements.filter(movement => sameHex(movement.sender, intent.sender) &&
    sameHex(movement.recipient, intent.recipient) && movement.amount === intent.amount)
  return matches.length === 1 ? { status: 'confirmed', block, logIndex: matches[0].logIndex } : { status: 'unknown' }
}
