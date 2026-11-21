import type { Address, Hex } from 'viem'

type ProviderEvent = 'accountsChanged' | 'chainChanged' | 'disconnect'
type Listener = () => void

interface UsdcWalletTransaction {
  chainId: string
  from: Address
  to: Address
  data: Hex
  value: '0x0'
  type: '0x2'
  gas: Hex
  maxFeePerGas: Hex
  maxPriorityFeePerGas: '0x0'
}

type WalletRequest =
  | { method: 'eth_requestAccounts' | 'eth_accounts' | 'eth_chainId'; params?: never }
  | { method: 'wallet_switchEthereumChain'; params: readonly [{ chainId: string }] }
  | { method: 'eth_sendTransaction'; params: readonly [UsdcWalletTransaction] }

export interface WalletProvider {
  request(args: WalletRequest): Promise<unknown>
  on(event: ProviderEvent, listener: Listener): void
  removeListener(event: ProviderEvent, listener: Listener): void
}

export function injectedWallet(): WalletProvider | null {
  const { ethereum } = window as unknown as { ethereum?: unknown }
  if (!ethereum || typeof ethereum !== 'object') return null
  const provider = ethereum as Partial<WalletProvider>
  return typeof provider.request === 'function' &&
    typeof provider.on === 'function' && typeof provider.removeListener === 'function'
    ? provider as WalletProvider
    : null
}

export function providerErrorCode(error: unknown): unknown {
  return error && typeof error === 'object' && 'code' in error ? error.code : null
}

export async function inspectWallet(provider: WalletProvider) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.all([
        provider.request({ method: 'eth_accounts' }),
        provider.request({ method: 'eth_chainId' }),
      ]),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Wallet inspection timed out')), 8000)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}
