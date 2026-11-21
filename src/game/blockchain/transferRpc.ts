import {
  createPublicClient, encodeFunctionData, http, parseAbi,
  type Hash, type Transport,
} from 'viem'
import { ARC_MAINNET, parseChainId } from './arcConfig'
import { observeTransfer, verifyIntent } from './transferVerification'
import { assertAffordable, TransferCheckError, type TransferIntent } from './transferValidation'

const usdcAbi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address recipient, uint256 amount) returns (bool)',
])

const MIN_ARC_FEE_PER_GAS = 20_000_000_000n

export interface TransferQuote {
  intent: TransferIntent
  available: bigint
  gas: bigint
  maxFeePerGas: bigint
  fee: bigint
  head: bigint
}

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
    const [simulation, estimate, suggestion, head] = await Promise.all([
      client.simulateContract({
        account: intent.sender, address: token, abi: usdcAbi,
        functionName: 'transfer', args: [intent.recipient, intent.amount],
      }),
      client.estimateGas({ account: intent.sender, to: token, data: transferData(intent) }),
      client.getGasPrice(),
      client.getBlockNumber({ cacheTime: 0 }),
    ])
    if (simulation.result !== true || estimate <= 0n || suggestion <= 0n) {
      throw new TransferCheckError('Arc could not simulate or estimate this transfer.')
    }
    // Give gas consumption a 20% margin. The wallet receives this exact fee cap.
    const gas = (estimate * 120n + 99n) / 100n
    const maxFeePerGas = suggestion < MIN_ARC_FEE_PER_GAS ? MIN_ARC_FEE_PER_GAS : suggestion
    const fee = gas * maxFeePerGas
    assertAffordable(available, native, intent.amount, fee)
    return { intent, available, gas, maxFeePerGas, fee, head }
  }

  async function inspect(hash: Hash) {
    await verifyChain()
    return observeTransfer(client, hash)
  }

  async function verify(hash: Hash, intent: TransferIntent) {
    return verifyIntent(await inspect(hash), intent, transferData(intent))
  }

  async function receipt(hash: Hash, intent: TransferIntent) {
    return (await verify(hash, intent)).status
  }

  return { quote, receipt, inspect, verify }
}
