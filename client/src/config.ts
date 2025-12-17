export const SPIN_CONTRACT_ADDRESS = "0xdB19da3BC195e32685136a63a3B014F74929dE64" as const;
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;

export const ARC_TESTNET = {
  chainId: 5042002,
  chainIdHex: "0x4CFB32",
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
    name: "spinsUsedToday",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimReward",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "pendingRewards",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastSpinTimestamp",
    inputs: [{ name: "user", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "SpinResult",
    inputs: [
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "reward", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "RewardClaimed",
    inputs: [
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
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

export const MAX_SPINS_PER_DAY = 5;
