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
- **Spin Contract**: `0x737aA4096a61A155197f5Aa952a273143C90a0Cc`
- **USDC Token**: `0x3600000000000000000000000000000000000000`
- **Wallet Support**: MetaMask and Rabby (via window.ethereum)
- **Block Explorer**: https://testnet.arcscan.app

### Contract ABI
```
- function spin(uint256 random) - Spin the wheel with a random number
- function spinsLeft(address user) view returns (uint256) - Get remaining spins for user
- function nextReset(address user) view returns (uint256) - Get timestamp when spins reset
- event SpinPlayed(address indexed player, uint256 reward, uint256 random) - Event emitted after spin
```

### Key Design Decisions
1. **20 Spins Per Day**: Users are limited to 20 spins per wallet per 24 hours
2. **Contract-Determined Rewards**: The wheel animation stops on the prize returned by the contract's SpinPlayed event
3. **Network Auto-Switch**: App automatically prompts users to switch to Arc Testnet
4. **Dark Casino Theme**: Modern Web3 casino aesthetic with neon accents
5. **Liquidity Guard**: Spin disabled if contract balance < 1000 USDC

### Prize Pool
- 1000 USDC (2% chance)
- 200 USDC (3% chance)
- 100 USDC (10% chance)
- 50 USDC (5% chance)
- 20 USDC (~5% chance)
- 10 USDC (10% chance)
- 5 USDC (15% chance)
- Nothing (remaining %)

## Spin Flow (Contract-Synchronized)
The wheel animation is 100% synchronized with the blockchain result:

**Phase 1: Blockchain Transaction**
1. User clicks SPIN button
2. Button shows "Confirm in wallet..." status
3. Generate random number using crypto.getRandomValues
4. Call spin(random) on the contract
5. Wallet opens for transaction confirmation
6. Status changes to "Waiting for blockchain result..."
7. Wait for transaction to be mined
8. Parse SpinPlayed event (filtered by connected wallet address)

**Phase 2: Visual Animation (only after event received)**
9. Extract exact reward value from SpinPlayed event
10. Map reward to the correct wheel sector
11. Status changes to "Spinning..."
12. Animate wheel for ~10 seconds
13. Stop exactly at the sector corresponding to the reward
14. Show congratulations modal with prize amount
15. Update USDC balance and spins counter from contract

**State Management:**
- `isWaitingForBlockchain`: True during transaction confirmation
- `isAnimating`: True during wheel animation
- `spinStatus`: Shows current phase message
- Button disabled when either state is true

## Daily Spin Limit
- Users are limited to 20 spins per 24 hours
- Read spinsLeft(user) from contract
- Display "Spins left today: X / 20"
- When limit is reached:
  - Read nextReset(user) for countdown
  - Show countdown timer (HH:MM:SS)
  - Enable SPIN again only after reset

## Balance Check
- Read contract USDC balance
- If contract balance < 1000 USDC:
  - Disable SPIN button
  - Show message: "Spin temporarily disabled due to low liquidity"

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
