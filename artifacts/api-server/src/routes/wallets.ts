import { Router } from "express";
import { createHash } from "crypto";
import { db, walletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: Router = Router();

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

router.get("/wallets/:id/exists", async (req, res) => {
  try {
    const id = String(req.params.id).trim().toUpperCase();
    const rows = await db
      .select({ walletId: walletsTable.walletId })
      .from(walletsTable)
      .where(eq(walletsTable.walletId, id));
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/wallets/register", async (req, res) => {
  try {
    const { walletId, password, walletData } = req.body as {
      walletId?: string;
      password?: string;
      walletData?: unknown;
    };

    if (!walletId || !password || !walletData) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const id = String(walletId).trim().toUpperCase();
    if (!/^[A-Z0-9_]{4,20}$/.test(id)) {
      res.status(400).json({ error: "Invalid Wallet ID format" });
      return;
    }

    const existing = await db
      .select({ walletId: walletsTable.walletId })
      .from(walletsTable)
      .where(eq(walletsTable.walletId, id));

    if (existing.length > 0) {
      res.status(409).json({ error: "This Wallet ID is already taken" });
      return;
    }

    await db.insert(walletsTable).values({
      walletId: id,
      passwordHash: hashPassword(String(password)),
      walletData: walletData as Record<string, unknown>,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/wallets/login", async (req, res) => {
  try {
    const { walletId, password } = req.body as {
      walletId?: string;
      password?: string;
    };

    if (!walletId || !password) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const id = String(walletId).trim().toUpperCase();
    const rows = await db
      .select()
      .from(walletsTable)
      .where(eq(walletsTable.walletId, id));

    if (rows.length === 0) {
      res.status(404).json({ error: "Wallet ID not found" });
      return;
    }

    const record = rows[0];
    if (record.passwordHash !== hashPassword(String(password))) {
      res.status(401).json({ error: "Incorrect password" });
      return;
    }

    res.json({ ok: true, walletData: record.walletData });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/wallets/:id/sync", async (req, res) => {
  try {
    const id = String(req.params.id).trim().toUpperCase();
    const { password, walletData } = req.body as {
      password?: string;
      walletData?: unknown;
    };

    if (!password || !walletData) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const rows = await db
      .select({ walletId: walletsTable.walletId, passwordHash: walletsTable.passwordHash })
      .from(walletsTable)
      .where(eq(walletsTable.walletId, id));

    if (rows.length === 0) {
      res.status(404).json({ error: "Wallet not found" });
      return;
    }

    if (rows[0].passwordHash !== hashPassword(String(password))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    await db
      .update(walletsTable)
      .set({ walletData: walletData as Record<string, unknown>, updatedAt: new Date() })
      .where(eq(walletsTable.walletId, id));

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
