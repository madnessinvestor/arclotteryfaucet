import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClaimHistorySchema } from "@shared/schema";

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
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const claims = await storage.getClaimHistory(limit);
      res.json(claims);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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

  return httpServer;
}
