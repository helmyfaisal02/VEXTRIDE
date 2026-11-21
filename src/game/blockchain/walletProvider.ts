type ProviderEvent = 'accountsChanged' | 'chainChanged' | 'disconnect'
type Listener = () => void

export interface WalletProvider {
  request(args: {
    method: 'eth_requestAccounts' | 'eth_accounts' | 'eth_chainId' | 'wallet_switchEthereumChain'
    params?: readonly [{ chainId: string }]
  }): Promise<unknown>
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
