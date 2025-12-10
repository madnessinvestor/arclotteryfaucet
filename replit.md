# ArcMiner - Fake USDC Mining dApp

## Overview

ArcMiner is a decentralized application (dApp) that simulates USDC mining on the Arc Testnet. Users connect their wallet, run a simulated mining process, and claim fake USDC tokens from a pre-deployed smart contract. The application provides a gamified mining experience with progress tracking, hash rate simulation, and claim history.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, built using Vite
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **State Management**: React Query for server state, React hooks for local state
- **Web3 Integration**: wagmi + viem for wallet connection and blockchain interactions

### Backend Architecture
- **Server**: Express.js running on Node.js
- **API Pattern**: RESTful endpoints under `/api/*`
- **Development**: Hot module replacement via Vite middleware
- **Production**: Static file serving from built assets

### Data Storage
- **Schema Definition**: Drizzle ORM with PostgreSQL dialect
- **Current Storage**: In-memory storage (MemStorage class) for development
- **Database Ready**: Schema defined for PostgreSQL migration when needed
- **Main Entity**: `claim_history` table tracking wallet claims with amounts and transaction hashes

### Blockchain Integration
- **Network**: Arc Testnet (Chain ID: 5042002, RPC: https://rpc.testnet.arc.network)
- **Smart Contract**: Pre-deployed faucet at `0xd9145CCE52D386f254917e481eB44e9943F39138`
- **Token**: USDC contract at `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
- **Wallet Connection**: MetaMask via injected connector

### Key Design Decisions
1. **Simulated Mining**: Mining is purely visual/frontend - actual tokens come from faucet contract claims
2. **Separation of Concerns**: Blockchain interactions handled client-side, claim history stored server-side
3. **Pre-deployed Contract**: The smart contract should NOT be redeployed - only frontend integration

## External Dependencies

### Blockchain/Web3
- **wagmi**: React hooks for Ethereum wallet interactions
- **viem**: Low-level Ethereum client library
- **Arc Testnet RPC**: `https://rpc.testnet.arc.network`

### UI Components
- **shadcn/ui**: Full component library with Radix UI primitives
- **Tailwind CSS v4**: Utility-first CSS framework
- **Lucide React**: Icon library

### Backend Services
- **PostgreSQL**: Database (via Drizzle ORM when provisioned)
- **connect-pg-simple**: Session storage for PostgreSQL

### Development Tools
- **Vite**: Build tool and dev server
- **Drizzle Kit**: Database migrations (`npm run db:push`)
- **tsx**: TypeScript execution for server

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string (required for database features)