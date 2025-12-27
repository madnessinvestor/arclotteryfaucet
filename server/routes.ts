import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClaimHistorySchema } from "@shared/schema";

const FAUCET_CONTRACT = "0xBd736A5D744A6364dd74B12Bb679d66360d7AeD9";
const SPIN_CONTRACT = "0x737aA4096a61A155197f5Aa952a273143C90a0Cc";
const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
const ARCSCAN_API = "https://testnet.arcscan.app/api";
const ARC_RPC = "https://rpc.testnet.arc.network";

interface ArcscanTokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  tokenDecimal: string;
  timeStamp: string;
  contractAddress: string;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post("/api/claim-history", async (req, res) => {
    try {
      const validatedData = insertClaimHistorySchema.parse(req.body);
      const claim = await storage.createClaimHistory(validatedData);
      res.json(claim);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/claim-history", async (req, res) => {
    try {
      const response = await fetch(
        `${ARCSCAN_API}?module=account&action=tokentx&address=${FAUCET_CONTRACT}&page=1&offset=100&sort=desc`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch from arcscan');
      }
      
      const data = await response.json();
      
      if (data.status !== "1" || !data.result) {
        res.json([]);
        return;
      }
      
      const TARGET_VALUES = [
        BigInt(1000) * BigInt(10 ** 6),
        BigInt(200) * BigInt(10 ** 6),
        BigInt(100) * BigInt(10 ** 6),
        BigInt(50) * BigInt(10 ** 6),
        BigInt(75) * BigInt(10 ** 6),
        BigInt(100) * BigInt(10 ** 6)
      ];
      
      const claims = (data.result as ArcscanTokenTransfer[])
        .filter((tx: ArcscanTokenTransfer) => {
          const fromLower = tx.from.toLowerCase();
          const contractLower = SPIN_CONTRACT.toLowerCase();
          const tokenLower = tx.contractAddress?.toLowerCase() || '';
          const usdcLower = USDC_ADDRESS.toLowerCase();
          
          try {
            const valueBigInt = BigInt(tx.value);
            return fromLower === contractLower && 
                   tokenLower === usdcLower && 
                   TARGET_VALUES.includes(valueBigInt);
          } catch {
            return false;
          }
        })
        .map((tx: ArcscanTokenTransfer) => {
          const decimals = parseInt(tx.tokenDecimal || '6');
          const value = Number(BigInt(tx.value)) / Math.pow(10, decimals);
          return {
            id: tx.hash.slice(0, 8),
            walletAddress: tx.to,
            amount: value.toFixed(6),
            transactionHash: tx.hash,
            claimedAt: new Date(parseInt(tx.timeStamp) * 1000).toISOString()
          };
        });
      
      res.json(claims);
    } catch (error: any) {
      console.error('Error fetching claim history:', error);
      const localClaims = await storage.getClaimHistory(50);
      res.json(localClaims);
    }
  });

  app.get("/api/claim-history/:walletAddress", async (req, res) => {
    try {
      const { walletAddress } = req.params;
      const claims = await storage.getClaimHistoryByWallet(walletAddress);
      res.json(claims);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/total-claimed", async (req, res) => {
    try {
      const response = await fetch(
        `${ARCSCAN_API}?module=account&action=tokentx&address=${FAUCET_CONTRACT}&page=1&offset=1000&sort=desc`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch from arcscan');
      }
      
      const data = await response.json();
      
      if (data.status !== "1" || !data.result) {
        res.json({ totalClaimed: "0", claimCount: 0 });
        return;
      }
      
      const TARGET_VALUES = [
        BigInt(1000) * BigInt(10 ** 6),
        BigInt(200) * BigInt(10 ** 6),
        BigInt(100) * BigInt(10 ** 6),
        BigInt(50) * BigInt(10 ** 6),
        BigInt(75) * BigInt(10 ** 6),
        BigInt(100) * BigInt(10 ** 6)
      ];
      
      const validClaims = (data.result as ArcscanTokenTransfer[])
        .filter((tx: ArcscanTokenTransfer) => {
          const fromLower = tx.from.toLowerCase();
          const contractLower = SPIN_CONTRACT.toLowerCase();
          const tokenLower = tx.contractAddress?.toLowerCase() || '';
          const usdcLower = USDC_ADDRESS.toLowerCase();
          
          try {
            const valueBigInt = BigInt(tx.value);
            return fromLower === contractLower && 
                   tokenLower === usdcLower && 
                   TARGET_VALUES.includes(valueBigInt);
          } catch {
            return false;
          }
        });
      
      const totalClaimed = validClaims.reduce((sum, tx) => {
        const decimals = parseInt(tx.tokenDecimal || '6');
        const value = Number(BigInt(tx.value)) / Math.pow(10, decimals);
        return sum + value;
      }, 0);
      
      res.json({ 
        totalClaimed: totalClaimed.toFixed(2), 
        claimCount: validClaims.length 
      });
    } catch (error: any) {
      console.error('Error fetching total claimed:', error);
      res.json({ totalClaimed: "0", claimCount: 0 });
    }
  });

  app.get("/api/contract-balance", async (req, res) => {
    try {
      const addressWithoutPrefix = SPIN_CONTRACT.slice(2).toLowerCase();
      const paddedAddress = addressWithoutPrefix.padStart(64, '0');
      const balanceOfData = "0x70a08231" + paddedAddress;
      
      const response = await fetch(ARC_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [
            {
              to: USDC_ADDRESS,
              data: balanceOfData,
            },
            "latest",
          ],
          id: 1,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch contract balance");
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message);
      }

      const balanceHex = data.result;
      const balanceWei = BigInt(balanceHex);
      const balanceUSDC = Number(balanceWei) / Math.pow(10, 6);

      res.json({ 
        balance: balanceUSDC.toFixed(2),
        balanceRaw: balanceWei.toString()
      });
    } catch (error: any) {
      console.error("Error fetching contract balance:", error);
      res.json({ balance: "0.00", balanceRaw: "0" });
    }
  });

  app.post("/api/spin-result", async (req, res) => {
    try {
      const { walletAddress, reward, transactionHash } = req.body;
      
      if (!walletAddress || reward === undefined || !transactionHash) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      res.json({ 
        success: true, 
        message: reward > 0 ? `Congratulations! You won ${reward} USDC!` : "Better luck next time!",
        reward,
        walletAddress,
        transactionHash
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
