import { getAddress, isAddress, type Address, type Hash } from 'viem'
import { ARC_MAINNET } from './arcConfig'
import { ROUTER, type RouterIntent, type RouterStep } from './routerContract'
import { ROUTER_AMOUNT_LIMIT, sameAddress } from './routerRpc'
import { isTransactionHash } from './transferValidation'

export const ROUTER_JOURNAL = 'vextride.arc.router.v1'
const statuses = ['awaiting', 'pending', 'unknown', 'approved', 'confirmed', 'reverted', 'rejected', 'cancelled'] as const
type Status = typeof statuses[number]
export interface RouterRecord {
  version: 1
  chainId: number
  router: Address
  sender: Address
  reference: Hash
  amount: string
  step: RouterStep
  status: Status
  head: string
  hash: Hash | null
  approvalHash: Hash | null
}

export const routerIntent = (record: RouterRecord): RouterIntent => ({
  sender: record.sender, reference: record.reference, amount: BigInt(record.amount),
})
export const routerUnresolved = (record: RouterRecord) =>
  record.status === 'awaiting' || record.status === 'pending' || record.status === 'unknown'
export const sameRouterRecord = (first: RouterRecord | null, second: RouterRecord | null) =>
  JSON.stringify(first) === JSON.stringify(second)
const decimal = (value: unknown): value is string => typeof value === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(value)

export function decodeRouterRecord(raw: string | null, sender: Address): RouterRecord | null {
  if (raw === null) return null
  if (raw.length > 4096) throw new Error('Invalid router record size')
  const data: unknown = JSON.parse(raw)
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid router record')
  const { version, chainId, router, sender: payer, reference, amount, step, status, head, hash, approvalHash } =
    data as Record<string, unknown>
  if (version !== 1 || chainId !== ARC_MAINNET.chain.id || typeof router !== 'string' || !sameAddress(router, ROUTER.address) ||
      typeof payer !== 'string' || !isAddress(payer) || !sameAddress(payer, sender) || sameAddress(payer, ROUTER.recipient) ||
      !isTransactionHash(reference) || !decimal(amount) || BigInt(amount) < 1n || BigInt(amount) > ROUTER_AMOUNT_LIMIT ||
      !decimal(head) || (step !== 'approval' && step !== 'payment') || !statuses.includes(status as Status) ||
      (hash !== null && !isTransactionHash(hash)) || (approvalHash !== null && !isTransactionHash(approvalHash))) {
    throw new Error('Invalid router record fields')
  }
  if ((['awaiting', 'rejected', 'cancelled'].includes(status as string) && hash !== null) ||
      (['pending', 'approved', 'confirmed', 'reverted'].includes(status as string) && hash === null) ||
      (step === 'approval' && (approvalHash !== null || status === 'confirmed')) ||
      (step === 'payment' && status === 'approved') || (hash !== null && approvalHash !== null && sameAddress(hash, approvalHash))) {
    throw new Error('Inconsistent router record')
  }
  return {
    version, chainId, router: ROUTER.address, sender: getAddress(payer), reference: reference.toLowerCase() as Hash,
    amount, step, status: status as Status, head, hash: hash?.toLowerCase() as Hash ?? null,
    approvalHash: approvalHash?.toLowerCase() as Hash ?? null,
  }
}

export function createRouterJournal(storage: () => Pick<Storage, 'getItem' | 'setItem'>) {
  const key = (sender: Address) => `${ROUTER_JOURNAL}.${ARC_MAINNET.chain.id}.${sender.toLowerCase()}`
  const read = (sender: Address) => decodeRouterRecord(storage().getItem(key(sender)), sender)
  function save(record: RouterRecord, previous: RouterRecord | null) {
    const accountKey = key(record.sender)
    const target = storage()
    if (!sameRouterRecord(read(record.sender), previous)) throw new Error('Router journal changed')
    const normalized = decodeRouterRecord(JSON.stringify(record), record.sender)
    if (!normalized) throw new Error('Invalid router record')
    const raw = JSON.stringify(normalized)
    target.setItem(accountKey, raw)
    if (target.getItem(accountKey) !== raw) throw new Error('Router record was not retained')
    return normalized
  }
  return { read, save }
}

export function newPaymentReference(): Hash {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const reference = `0x${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`
  if (!isTransactionHash(reference)) throw new Error('Could not create a nonzero reference')
  return reference
}
