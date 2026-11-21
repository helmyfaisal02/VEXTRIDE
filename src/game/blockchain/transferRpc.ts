import {
  createPublicClient, decodeEventLog, encodeFunctionData, http, parseAbi,
  TransactionReceiptNotFoundError, type Hash, type Transport,
} from 'viem'
import { ARC_MAINNET, parseChainId } from './arcConfig'
import { assertAffordable, TransferCheckError, type TransferIntent } from './transferValidation'

const usdcAbi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address recipient, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

const MIN_ARC_FEE_PER_GAS = 20_000_000_000n

export interface TransferQuote {
  intent: TransferIntent
  available: bigint
  gas: bigint
  maxFeePerGas: bigint
  fee: bigint
}

export type ReceiptOutcome = 'pending' | 'confirmed' | 'reverted' | 'unknown'

export const transferData = (intent: TransferIntent) => encodeFunctionData({
  abi: usdcAbi, functionName: 'transfer', args: [intent.recipient, intent.amount],
})

export function createTransferRpc(transport: Transport = http(ARC_MAINNET.rpcUrl, {
  timeout: 8000, retryCount: 0, fetchOptions: { credentials: 'omit', redirect: 'error' },
})) {
  const client = createPublicClient({ chain: ARC_MAINNET.chain, transport })
  const token = ARC_MAINNET.usdcAddress

  async function verifyChain() {
    const chain = await client.request({ method: 'eth_chainId' })
    if (parseChainId(chain) !== ARC_MAINNET.chain.id) throw new Error('Unexpected RPC chain')
  }

  async function quote(intent: TransferIntent): Promise<TransferQuote> {
    await verifyChain()
    const [available, native] = await Promise.all([
      client.readContract({ address: token, abi: usdcAbi, functionName: 'balanceOf', args: [intent.sender] }),
      client.getBalance({ address: intent.sender }),
    ])
    assertAffordable(available, native, intent.amount, 0n)
    const [simulation, estimate, suggestion] = await Promise.all([
      client.simulateContract({
        account: intent.sender, address: token, abi: usdcAbi,
        functionName: 'transfer', args: [intent.recipient, intent.amount],
      }),
      client.estimateGas({ account: intent.sender, to: token, data: transferData(intent) }),
      client.getGasPrice(),
    ])
    if (simulation.result !== true || estimate <= 0n || suggestion <= 0n) {
      throw new TransferCheckError('Arc could not simulate or estimate this transfer.')
    }
    // Give gas consumption a 20% margin. The wallet receives this exact fee cap.
    const gas = (estimate * 120n + 99n) / 100n
    const maxFeePerGas = suggestion < MIN_ARC_FEE_PER_GAS ? MIN_ARC_FEE_PER_GAS : suggestion
    const fee = gas * maxFeePerGas
    assertAffordable(available, native, intent.amount, fee)
    return { intent, available, gas, maxFeePerGas, fee }
  }

  async function receipt(hash: Hash, intent: TransferIntent): Promise<ReceiptOutcome> {
    await verifyChain()
    let receipt
    try {
      receipt = await client.getTransactionReceipt({ hash })
    } catch (error) {
      if (error instanceof TransactionReceiptNotFoundError) return 'pending'
      throw error
    }
    if (receipt.transactionHash?.toLowerCase() !== hash.toLowerCase() ||
        receipt.from?.toLowerCase() !== intent.sender.toLowerCase() ||
        receipt.to?.toLowerCase() !== token || !receipt.blockHash || receipt.blockNumber == null) return 'unknown'
    if (receipt.status === 'reverted') return 'reverted'
    if (receipt.status !== 'success') return 'unknown'
    // Arc exposes the six-decimal Transfer event at the ERC-20 interface.
    const matched = receipt.logs.some(log => {
      if (log.address.toLowerCase() !== token || log.removed) return false
      try {
        const event = decodeEventLog({ abi: usdcAbi, eventName: 'Transfer', data: log.data, topics: log.topics })
        return event.args.from.toLowerCase() === intent.sender.toLowerCase() &&
          event.args.to.toLowerCase() === intent.recipient.toLowerCase() && event.args.value === intent.amount
      } catch {
        return false
      }
    })
    return matched ? 'confirmed' : 'unknown'
  }

  return { quote, receipt }
}
