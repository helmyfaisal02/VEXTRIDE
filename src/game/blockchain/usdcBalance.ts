import { createPublicClient, formatUnits, http, isAddress, parseAbi, type Transport } from 'viem'
import { ARC_MAINNET, parseChainId } from './arcConfig'

const balanceAbi = parseAbi(['function balanceOf(address owner) view returns (uint256)'])

export function createArcBalanceReader(transport: Transport = http(ARC_MAINNET.rpcUrl, {
  timeout: 8000,
  retryCount: 0,
  fetchOptions: { credentials: 'omit', redirect: 'error' },
})) {
  const client = createPublicClient({ chain: ARC_MAINNET.chain, transport })
  return async (address: string) => {
    if (!isAddress(address)) throw new Error('Invalid wallet address')
    const chainId = await client.request({ method: 'eth_chainId' })
    if (parseChainId(chainId) !== ARC_MAINNET.chain.id) throw new Error('Unexpected Arc RPC chain')
    return client.readContract({
      address: ARC_MAINNET.usdcAddress,
      abi: balanceAbi,
      functionName: 'balanceOf',
      args: [address],
    })
  }
}

export const readArcUsdc = createArcBalanceReader()
export const formatUsdc = (balance: bigint) => formatUnits(balance, ARC_MAINNET.usdcDecimals)
