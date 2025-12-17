# Arc Spin Lottery - Web3 Lottery Game

## Overview

Arc Spin Lottery is a Web3 lottery game running on Arc Testnet where users can spin a wheel to win USDC prizes. Users connect their wallet, spin the colorful animated wheel, and win prizes determined by the smart contract. The frontend never calculates rewards - the contract is the single source of truth.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, built using Vite
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: React hooks for local state
- **Web3 Integration**: ethers.js for wallet connection and blockchain interactions

### Backend Architecture
- **Server**: Express.js running on Node.js
- **API Pattern**: RESTful endpoints under `/api/*`
- **Development**: Hot module replacement via Vite middleware

### Blockchain Integration
- **Network**: Arc Testnet (Chain ID: 5042002, RPC: https://rpc.testnet.arc.network)
- **Spin Contract**: `0xdB19da3BC195e32685136a63a3B014F74929dE64`
- **USDC Token**: `0x3600000000000000000000000000000000000000`
- **Wallet Support**: MetaMask and Rabby (via window.ethereum)
- **Block Explorer**: https://testnet.arcscan.app

### Contract ABI
```
- function spin(uint256 random) - Spin the wheel with a random number
- function spinsUsedToday(address user) view returns (uint256) - Get spins used today
- event SpinResult(address indexed user, uint256 reward) - Event emitted after spin
```

### Key Design Decisions
1. **5 Spins Per Day**: Users are limited to 5 spins per wallet per 24 hours
2. **Contract-Determined Rewards**: The wheel animation stops on the prize returned by the contract's SpinResult event
3. **Network Auto-Switch**: App automatically prompts users to switch to Arc Testnet
4. **Dark Casino Theme**: Modern Web3 casino aesthetic with neon accents

### Prize Pool
- 1000 USDC (2% chance)
- 200 USDC (3% chance)
- 100 USDC (10% chance)
- 20 USDC (~5% chance)
- 10 USDC (10% chance)
- 5 USDC (20% chance)
- Nothing (remaining %)

## Spin Flow
1. User clicks SPIN button
2. Generate random number using crypto.getRandomValues
3. Call spin(random) on the contract
4. Wallet opens for transaction confirmation
5. Wait for transaction confirmation
6. Parse SpinResult event to get the reward
7. Animate wheel to stop on the correct prize
8. Show congratulations modal with prize amount and claim button
9. User clicks Claim to receive USDC in their wallet
10. Update USDC balance and spins counter

## Claim Flow
1. When user wins a prize, pendingRewards is updated in the contract
2. User clicks "Claim" button in the win modal or on the main screen
3. claimReward() is called on the contract
4. USDC is transferred to user's wallet
5. UI updates to show new balance

## Daily Spin Limit
- Users are limited to 5 spins per 24 hours
- When limit is reached, a countdown timer shows time until next spins are available
- Timer updates every second and refreshes spins count when it reaches zero

## External Dependencies

### Blockchain/Web3
- **ethers**: Ethereum library for wallet and contract interactions
- **Arc Testnet RPC**: `https://rpc.testnet.arc.network`

### UI Components
- **shadcn/ui**: Full component library with Radix UI primitives
- **Tailwind CSS v4**: Utility-first CSS framework
- **Lucide React**: Icon library
- **react-icons**: Social media icons

### Development Tools
- **Vite**: Build tool and dev server
- **tsx**: TypeScript execution for server
