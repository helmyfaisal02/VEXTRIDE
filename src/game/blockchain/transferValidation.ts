import { getAddress, isAddress, maxUint256, parseUnits, zeroAddress, type Address, type Hash } from 'viem'
import { ARC_MAINNET } from './arcConfig'

export interface TransferIntent {
  sender: Address
  recipient: Address
  amount: bigint
}

export class TransferCheckError extends Error {}

export const usdcToNative = (amount: bigint) =>
  amount * 10n ** BigInt(ARC_MAINNET.chain.nativeCurrency.decimals - ARC_MAINNET.usdcDecimals)

export function validateTransfer(sender: Address, recipientInput: string, amountInput: string): TransferIntent {
  const address = recipientInput.trim()
  if (!isAddress(address)) throw new TransferCheckError('Enter a complete EVM recipient address.')
  const recipient = getAddress(address)
  if (recipient === zeroAddress || recipient === ARC_MAINNET.usdcAddress || recipient.toLowerCase() === sender.toLowerCase()) {
    throw new TransferCheckError('Enter a recipient other than your own wallet, the zero address or the USDC contract.')
  }
  const text = amountInput.trim()
  if (text.length > 80 || !/^\d+(?:\.\d{1,6})?$/.test(text)) {
    throw new TransferCheckError('Enter a positive USDC amount with up to six decimal places.')
  }
  const amount = parseUnits(text, ARC_MAINNET.usdcDecimals)
  if (amount <= 0n || amount > maxUint256) throw new TransferCheckError('The transfer amount is out of range.')
  return { sender, recipient, amount }
}

export function assertAffordable(erc20: bigint, native: bigint, amount: bigint, fee: bigint) {
  if (erc20 < amount) throw new TransferCheckError('Insufficient USDC for this amount.')
  if (native < usdcToNative(amount) + fee) {
    throw new TransferCheckError('Leave enough USDC in this wallet to cover the network fee as well as the transfer.')
  }
}

export const isTransactionHash = (result: unknown): result is Hash =>
  typeof result === 'string' && /^0x[0-9a-f]{64}$/i.test(result) && !/^0x0+$/i.test(result)
