export const SPIN_CONTRACT_ADDRESS = "0x737aA4096a61A155197f5Aa952a273143C90a0Cc" as const;
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;

export const ARC_TESTNET = {
  chainId: 5042002,
  chainIdHex: "0x4CEF52",
  name: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.network",
  explorer: "https://testnet.arcscan.app",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
} as const;

export const SPIN_CONTRACT_ABI = [
  {
    type: "function",
    name: "spin",
    inputs: [{ name: "random", type: "uint256", internalType: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "spinsLeft",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextReset",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "SpinPlayed",
    inputs: [
      { name: "player", type: "address", indexed: true, internalType: "address" },
      { name: "reward", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "random", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "timestamp", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "function",
    name: "totalSpins",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const USDC_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const MAX_SPINS_PER_DAY = 100;
export const MIN_CONTRACT_BALANCE = 1000;
