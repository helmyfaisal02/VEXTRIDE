import { formatUnits, getAddress, isAddress, type Address, type Hash } from 'viem'
import { createStore } from 'zustand/vanilla'
import { ARC_MAINNET } from './arcConfig'
import { isTransactionHash, validateTransfer, type TransferIntent } from './transferValidation'

export const TRANSFER_KEY = 'vextride.arc.transfers.v1'
const LIMIT = 80
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>
export type RecordStatus = 'awaiting' | 'submitted' | 'pending' | 'confirmed' | 'reverted' |
  'rejected' | 'unknown' | 'unavailable'

export interface TransferRecord {
  id: string
  chainId: number
  sender: Address
  recipient: Address
  amount: string
  hash: Hash | null
  status: RecordStatus
  createdAt: number
  checkedAt: number | null
  head: string
  block: string | null
  logIndex: number | null
}

export const verificationKey = (record: TransferRecord) =>
  [record.hash, record.status, record.block, record.logIndex, record.sender, record.recipient, record.amount].join(':')

export const isUnresolved = ({ status }: TransferRecord) =>
  status !== 'confirmed' && status !== 'reverted' && status !== 'rejected'

export const forAccount = (records: readonly TransferRecord[], sender: Address | null) =>
  sender ? records.filter(record => record.chainId === ARC_MAINNET.chain.id && record.sender.toLowerCase() === sender.toLowerCase()) : []

const decimal = (value: unknown): value is string => typeof value === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(value)
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const statuses: readonly string[] = ['awaiting','submitted','pending','confirmed','reverted','rejected','unknown','unavailable']

export const recordIntent = (record: TransferRecord): TransferIntent =>
  ({ sender: record.sender, recipient: record.recipient, amount: BigInt(record.amount) })

export function decodeTransferHistory(raw: string | null): TransferRecord[] {
  if (raw === null) return []
  if (raw.length > 100_000) throw new Error('Transfer history exceeds size limit')
  const data: unknown = JSON.parse(raw)
  if (!object(data) || data.version !== 1 || !Array.isArray(data.records) || data.records.length > LIMIT) {
    throw new Error('Invalid transfer history')
  }
  const ids = new Set<string>(), hashes = new Set<string>(), unresolved = new Set<Address>()
  return data.records.map((value: unknown) => {
    if (!object(value)) throw new Error('Invalid record')
    const { id, chainId, sender, recipient, amount, status, hash, createdAt, checkedAt, head, block, logIndex } = value
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) || ids.has(id) ||
        chainId !== ARC_MAINNET.chain.id || typeof sender !== 'string' || !isAddress(sender) ||
        typeof recipient !== 'string' || !decimal(amount) ||
        !decimal(head) || typeof status !== 'string' || !statuses.includes(status) ||
        !integer(createdAt) || createdAt > 8.64e15 || (checkedAt !== null && (!integer(checkedAt) || checkedAt < createdAt || checkedAt > 8.64e15)) ||
        (hash !== null && (!isTransactionHash(hash) || hashes.has(hash.toLowerCase())))) {
      throw new Error('Invalid record identity or values')
    }
    const intent = validateTransfer(getAddress(sender), recipient, formatUnits(BigInt(amount), ARC_MAINNET.usdcDecimals))
    const verified = status === 'confirmed' || status === 'reverted'
    if ((verified && (!decimal(block) || BigInt(block) <= BigInt(head) || checkedAt === null)) || (!verified && block !== null) ||
        (status === 'confirmed' ? !integer(logIndex) : logIndex !== null) ||
        (['submitted','pending','confirmed','reverted','unavailable'].includes(status) && hash === null) ||
        (['awaiting','rejected'].includes(status) && (hash !== null || checkedAt !== null))) {
      throw new Error('Contradictory transfer record')
    }
    if (!verified && status !== 'rejected') {
      if (unresolved.has(intent.sender)) throw new Error('Duplicate unresolved account')
      unresolved.add(intent.sender)
    }
    if (hash === null && checkedAt !== null) throw new Error('Cannot check a missing hash')
    ids.add(id)
    const normalizedHash = hash?.toLowerCase() as Hash | undefined
    if (normalizedHash) hashes.add(normalizedHash)
    return {
      id, chainId, sender: intent.sender, recipient: intent.recipient, amount,
      status: status as RecordStatus, hash: normalizedHash ?? null, createdAt, checkedAt, head,
      block: block as string | null, logIndex: logIndex as number | null,
    }
  })
}

export function createTransferHistory(storage: () => StorageAccess, now = Date.now) {
  const store = createStore<{records: TransferRecord[]; warning: string; verified: Record<string, string>}>(() => ({ records: [], warning: '', verified: {} }))
  // Keep an observed outcome visible if localStorage fails after wallet handoff.
  const unsaved = new Map<string, TransferRecord>()
  let rawSeen: string | null | undefined

  function load(raw = storage().getItem(TRANSFER_KEY)) {
    const records = decodeTransferHistory(raw)
    if ([...unsaved.keys()].some(id => !records.some(record => record.id === id))) throw new Error('Unsaved operation was removed')
    return records.map(record => isUnresolved(record) ? unsaved.get(record.id) ?? record : record)
  }

  function sync() {
    try {
      const raw = storage().getItem(TRANSFER_KEY)
      if (raw === rawSeen) return
      const records = load(raw)
      rawSeen = raw
      store.setState({ records, warning: unsaved.size ? 'Some transfer updates are only in memory.' : '' })
    } catch {
      store.setState({ warning: 'Transfer history cannot be read. New sends are paused until local storage is available and valid.' })
    }
  }

  function write(records: TransferRecord[]) {
    const raw = JSON.stringify({ version: 1, records })
    const validated = decodeTransferHistory(raw)
    storage().setItem(TRANSFER_KEY, raw)
    rawSeen = raw
    unsaved.clear()
    store.setState({ records: validated, warning: '' })
  }

  function begin(intent: TransferIntent, head: bigint) {
    const records = load()
    if (forAccount(records, intent.sender).some(isUnresolved)) {
      throw new Error('Resolve the existing transfer in this browser before sending again.')
    }
    // Preserve all unresolved operations. Only prune the oldest settled entries.
    const removable = records.filter(record => !isUnresolved(record)).sort((a,b) => a.createdAt-b.createdAt)
    const evicted = records.length >= LIMIT ? removable[0] : undefined
    if (records.length >= LIMIT && !evicted) throw new Error('Transfer history is full of unresolved operations.')
    const record: TransferRecord = {
      id: crypto.randomUUID(), chainId: ARC_MAINNET.chain.id, sender: intent.sender,
      recipient: intent.recipient, amount: intent.amount.toString(), createdAt: now(),
      status: 'awaiting', hash: null, checkedAt: null, head: head.toString(), block: null, logIndex: null,
    }
    write([...records.filter(item => item.id !== evicted?.id), record])
    return record
  }

  function update(id: string, patch: Partial<Pick<TransferRecord, 'status' | 'hash' | 'checkedAt' | 'block' | 'logIndex'>>) {
    const previous = store.getState().records.find(item => item.id === id)
    if (!previous || (patch.hash && store.getState().records.some(item => item.id !== id && item.hash === patch.hash))) return null
    try {
      const records = load()
      const stored = records.find(item => item.id === id)
      if (!stored) throw new Error('Missing operation')
      if (!isUnresolved(stored)) return stored
      const record = { ...stored, ...unsaved.get(id), ...patch }
      if (record.hash && records.some(item => item.id !== id && item.hash === record.hash)) return null
      write(records.map(item => item.id === id ? record : item))
      return record
    } catch {
      const record = { ...previous, ...patch }
      unsaved.set(id, record)
      rawSeen = undefined
      store.setState({
        records: store.getState().records.map(item => item.id === id ? record : item),
        warning: 'Transfer update could not be saved. Keep the hash and check wallet activity before refreshing.',
      })
      return record
    }
  }

  function markVerified(record: TransferRecord) {
    const { verified } = store.getState()
    // Keep memory bounded when old settled entries are pruned.
    const remaining = store.getState().records.flatMap(item => verified[item.id] ? [[item.id, verified[item.id]] as const] : [])
    store.setState({ verified: { ...Object.fromEntries(remaining), [record.id]: verificationKey(record) } })
  }

  return { store, sync, begin, update, now, markVerified }
}
