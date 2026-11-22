import {
  createPublicClient, decodeEventLog, encodeEventTopics, http, keccak256, maxUint256,
  type Hash, type TransactionReceipt, type Transport,
} from 'viem'
import { ARC_MAINNET, parseChainId } from './arcConfig'
import { ROUTER, routerAbi, routerData, routerTarget, routerTokenAbi, type RouterIntent, type RouterStep } from './routerContract'
import { observeTransfer, type Observation, type Verification } from './transferVerification'
import { assertAffordable, TransferCheckError } from './transferValidation'

export const sameAddress = (first: string | null | undefined, second: string) => first?.toLowerCase() === second.toLowerCase()
export const ROUTER_AMOUNT_LIMIT = maxUint256 / 10n ** 12n
const minFeePerGas = 20_000_000_000n
// Screening allowance only. The actual payment needs its own freshly simulated quote after approval.
const provisionalPaymentGas = 200_000n
const settledTopic = encodeEventTopics({ abi: routerAbi, eventName: 'PaymentSettled' })[0]
const approvalTopic = encodeEventTopics({ abi: routerTokenAbi, eventName: 'Approval' })[0]
const transferTopic = encodeEventTopics({ abi: routerTokenAbi, eventName: 'Transfer' })[0]

export interface RouterQuote {
  intent: RouterIntent
  step: RouterStep
  allowance: bigint
  gas: bigint
  feeCap: bigint
  maxFeePerGas: bigint
  futurePaymentFee: bigint
  head: bigint
}

function singleEvent(receipt: TransactionReceipt, emitter: string, topic: string) {
  const matches = receipt.logs.filter(log => sameAddress(log.address, emitter) && log.topics[0] === topic)
  if (matches.length !== 1) return null
  const log = matches[0]
  return !log.removed && sameAddress(log.transactionHash, receipt.transactionHash) &&
    sameAddress(log.blockHash, receipt.blockHash) && log.blockNumber === receipt.blockNumber &&
    log.transactionIndex === receipt.transactionIndex && Number.isSafeInteger(log.logIndex) && log.logIndex >= 0 &&
    receipt.logs.filter(entry => entry.logIndex === log.logIndex).length === 1 ? log : null
}

export function verifyRouterEvidence(observation: Observation, step: RouterStep, intent: RouterIntent): Verification {
  if (!('transaction' in observation)) return { status: observation.status }
  const { transaction, receipt, block } = observation
  if (!sameAddress(transaction.from, intent.sender) || !sameAddress(transaction.to, routerTarget(step)) ||
      !sameAddress(transaction.input, routerData(step, intent)) || transaction.value !== 0n) return { status: 'unknown' }
  if (observation.status === 'reverted') return { status: 'reverted', block }

  try {
    if (step === 'approval') {
      const log = singleEvent(receipt, ARC_MAINNET.usdcAddress, approvalTopic)
      if (log?.topics.length === 3 && /^0x[\da-f]{64}$/i.test(log.data)) {
        const { args } = decodeEventLog({ abi: routerTokenAbi, eventName: 'Approval', data: log.data, topics: log.topics })
        if (sameAddress(args.owner, intent.sender) && sameAddress(args.spender, ROUTER.address) && args.value === intent.amount) {
          return { status: 'confirmed', block, logIndex: log.logIndex }
        }
      }
    } else {
      const log = singleEvent(receipt, ROUTER.address, settledTopic)
      const transfer = singleEvent(receipt, ARC_MAINNET.usdcAddress, transferTopic)
      const [movement] = observation.movements
      if (log?.topics.length === 4 && /^0x[\da-f]{64}$/i.test(log.data) &&
          transfer?.topics.length === 3 && /^0x[\da-f]{64}$/i.test(transfer.data) &&
          observation.movements.length === 1 && movement.logIndex === transfer.logIndex && transfer.logIndex < log.logIndex &&
          sameAddress(movement.sender, intent.sender) && sameAddress(movement.recipient, ROUTER.recipient) &&
          movement.amount === intent.amount) {
        const { args } = decodeEventLog({ abi: routerAbi, eventName: 'PaymentSettled', data: log.data, topics: log.topics })
        if (sameAddress(args.payer, intent.sender) && sameAddress(args.recipient, ROUTER.recipient) &&
            sameAddress(args.paymentReference, intent.reference) && args.amount === intent.amount) {
          return { status: 'confirmed', block, logIndex: log.logIndex }
        }
      }
    }
  } catch { /* Undecodable evidence cannot establish success. */ }
  return { status: 'unknown' }
}

export function createRouterRpc(transport: Transport = http(ARC_MAINNET.rpcUrl, {
  timeout: 8000, retryCount: 0, fetchOptions: { credentials: 'omit', redirect: 'error' },
})) {
  const client = createPublicClient({ chain: ARC_MAINNET.chain, transport, ccipRead: false })
  const token = ARC_MAINNET.usdcAddress
  const address = ROUTER.address

  async function verifyDeployment() {
    if (parseChainId(await client.request({ method: 'eth_chainId' })) !== ARC_MAINNET.chain.id) {
      throw new TransferCheckError('Unexpected RPC chain. Arc Mainnet is required.')
    }
    const [code, recipient, usdc] = await Promise.all([
      client.getCode({ address }),
      client.readContract({ address, abi: routerAbi, functionName: 'recipient' }),
      client.readContract({ address, abi: routerAbi, functionName: 'usdc' }),
    ])
    if (!code || code === '0x' || keccak256(code) !== ROUTER.runtimeHash ||
        !sameAddress(recipient, ROUTER.recipient) || !sameAddress(usdc, token)) {
      throw new TransferCheckError('The deployed router did not match the reviewed contract configuration.')
    }
  }

  async function quote(intent: RouterIntent, afterApproval: boolean): Promise<RouterQuote> {
    await verifyDeployment()
    const [available, native, allowance, used] = await Promise.all([
      client.readContract({ address: token, abi: routerTokenAbi, functionName: 'balanceOf', args: [intent.sender] }),
      client.getBalance({ address: intent.sender }),
      client.readContract({ address: token, abi: routerTokenAbi, functionName: 'allowance', args: [intent.sender, address] }),
      client.readContract({ address, abi: routerAbi, functionName: 'isReferenceUsed', args: [intent.sender, intent.reference] }),
    ])
    if (used) throw new TransferCheckError('This payment reference is already settled. Check transaction activity.')
    assertAffordable(available, native, intent.amount, 0n)
    const step = allowance < intent.amount ? 'approval' : 'payment'
    if (afterApproval && step === 'approval') {
      throw new TransferCheckError('The verified approval no longer provides enough allowance. Check wallet activity.')
    }
    const request = { account: intent.sender, to: routerTarget(step), data: routerData(step, intent) }
    const [simulation, estimate, suggestion, head] = await Promise.all([
      client.call(request),
      client.estimateGas(request),
      client.getGasPrice(),
      client.getBlockNumber({ cacheTime: 0 }),
    ])
    if (estimate <= 0n || suggestion <= 0n ||
        (step === 'approval' && simulation.data !== `0x${'0'.repeat(63)}1`) ||
        (step === 'payment' && simulation.data !== undefined && simulation.data !== '0x')) {
      throw new TransferCheckError('The Arc simulation or gas estimate did not match the intended action.')
    }
    const gas = (estimate * 120n + 99n) / 100n
    const maxFeePerGas = suggestion < minFeePerGas ? minFeePerGas : suggestion
    const feeCap = gas * maxFeePerGas
    const futurePaymentFee = step === 'approval' ? provisionalPaymentGas * maxFeePerGas : 0n
    assertAffordable(available, native, intent.amount, feeCap + futurePaymentFee)
    return { intent, step, gas, maxFeePerGas, feeCap, futurePaymentFee, head, allowance }
  }

  async function verify(hash: Hash, step: RouterStep, intent: RouterIntent) {
    await verifyDeployment()
    return verifyRouterEvidence(await observeTransfer(client, hash), step, intent)
  }

  return { quote, verify }
}
