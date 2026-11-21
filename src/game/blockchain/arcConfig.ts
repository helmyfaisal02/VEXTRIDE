import { arc } from 'viem/chains'

export const ARC_MAINNET = {
  chain: arc,
  label: 'Arc Mainnet',
  chainIdHex: '0x13b2',
  rpcUrl: 'https://rpc.mainnet.arc.io',
  usdcAddress: '0x3600000000000000000000000000000000000000',
  usdcDecimals: 6,
} as const

export function parseChainId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{1,14}$/i.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
