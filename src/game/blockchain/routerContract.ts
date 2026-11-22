import { encodeFunctionData, parseAbi, type Address, type Hash } from 'viem'
import { ARC_MAINNET } from './arcConfig'

export const ROUTER = {
  address: '0xcAD7E77c93485F7eADe96AC7a58437ded3777FCF',
  recipient: '0xa871d14AdBa4eacbD1fd63F5BD13fE0D80198b65',
  runtimeHash: '0x456cd28cc99be5c44370c206d6f6297ffcc69a85cc2857eca06ea8ea11346a5a',
} as const

// Mirrors the reviewed Solidity artifact, including inherited errors.
export const routerAbi = parseAbi([
  'constructor(address paymentRecipient)',
  'function isReferenceUsed(address payer, bytes32 paymentReference) view returns (bool)',
  'function pay(bytes32 paymentReference, uint256 amount)',
  'function recipient() view returns (address)',
  'function usdc() view returns (address)',
  'event PaymentSettled(address indexed payer, address indexed recipient, bytes32 indexed paymentReference, uint256 amount)',
  'error InvalidAmount(uint256 amount)',
  'error InvalidRecipient(address recipient)',
  'error InvalidReference()',
  'error PayerIsRecipient()',
  'error ReentrancyGuardReentrantCall()',
  'error ReferenceAlreadyUsed(address payer, bytes32 paymentReference)',
  'error SafeERC20FailedOperation(address token)',
  'error UnexpectedRecipientCredit(uint256 expected, uint256 observed)',
  'error UnsupportedUSDC()',
  'error WrongChain(uint256 actual)',
])

export const routerTokenAbi = parseAbi([
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

export type RouterStep = 'approval' | 'payment'
export interface RouterIntent {
  sender: Address
  reference: Hash
  amount: bigint
}

export const routerTarget = (step: RouterStep) => step === 'approval' ? ARC_MAINNET.usdcAddress : ROUTER.address
export const routerData = (step: RouterStep, intent: RouterIntent) => step === 'approval'
  ? encodeFunctionData({ abi: routerTokenAbi, functionName: 'approve', args: [ROUTER.address, intent.amount] })
  : encodeFunctionData({ abi: routerAbi, functionName: 'pay', args: [intent.reference, intent.amount] })
