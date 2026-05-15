import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const walletsTable = pgTable("wallets", {
  walletId: text("wallet_id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  walletData: jsonb("wallet_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WalletRecord = typeof walletsTable.$inferSelect;
