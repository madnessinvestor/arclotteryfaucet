import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const claimHistory = pgTable("claim_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
  transactionHash: varchar("transaction_hash", { length: 66 }),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
});

export const insertClaimHistorySchema = createInsertSchema(claimHistory).omit({
  id: true,
  claimedAt: true,
});

export type InsertClaimHistory = z.infer<typeof insertClaimHistorySchema>;
export type ClaimHistory = typeof claimHistory.$inferSelect;
