import { describe, expect, it } from "vitest";
import { hasMorePages, normalizeTransaction, withdrawalErrorMessage } from "./api";

describe("wallet contract", () => {
  it("normalizes the new transaction row", () => {
    const t = normalizeTransaction({ id: "1", type: "escrow_release", status: "posted", entry_type: "credit", amount: "16.00", balance_after: null, description: "x", reference: "o", created_at: "t" });
    expect(t).toMatchObject({ type: "escrow_release", entry_type: "credit", amount: "16.00", reference: "o" });
  });
  it("still reads the legacy row", () => {
    const t = normalizeTransaction({ id: "1", transaction_type: "payout", status: "completed", entry: { type: "debit", amount: "5.00" }, total_amount: "5.00", description: "", created_at: "t" });
    expect(t.entry_type).toBe("debit");
    expect(t.type).toBe("payout");
  });
  it("pages by page/page_size", () => {
    expect(hasMorePages({ count: 42, page: 1, page_size: 20, results: [] }, 20)).toBe(true);
    expect(hasMorePages({ count: 42, page: 3, page_size: 20, results: [] }, 42)).toBe(false);
  });
  it("prefers the server message, falls back by code", () => {
    expect(withdrawalErrorMessage({ message: "Minimum withdrawal is 50.00.", code: "below_minimum_withdrawal" }, "x")).toContain("50.00");
    expect(withdrawalErrorMessage({ message: "HTTP 400", code: "above_daily_limit" }, "x")).toMatch(/today/i);
  });
});
