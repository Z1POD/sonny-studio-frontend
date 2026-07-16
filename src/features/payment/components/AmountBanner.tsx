// src/features/payment/components/AmountBanner.tsx

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ReceiptText } from "lucide-react";
import { normalizeInvoiceDates } from "../lib/normalize";

interface AmountBannerProps {
  invoice: any;
}

export function AmountBanner({ invoice }: AmountBannerProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { createdAt, expiresAt } = normalizeInvoiceDates(invoice);

  return (
    <div
        className="
          mb-4 overflow-hidden rounded-2xl border
          border-emerald-300/60 dark:border-emerald-400/20
          bg-gradient-to-br
          from-emerald-50
          via-emerald-100/60
          to-background
          dark:from-emerald-900/30
          dark:via-emerald-800/10
          dark:to-emerald-950/40
        "
      >
      <div className="p-4 text-center">
        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300/70">
          Amount to send
        </p>

        <p className="mt-1 text-3xl font-bold tracking-tight text-emerald-950 dark:text-emerald-100">
          {invoice?.amount?.currency?.symbol} {invoice?.amount?.total}
        </p>

        {invoice?.payment?.warning && (
          <p className="mt-2 text-[11px] text-emerald-700/80 dark:text-emerald-300/60">
            {invoice.payment.warning}
          </p>
        )}
      </div>

      <button
        onClick={() => setShowDetails((s) => !s)}
        className="
          flex w-full items-center justify-center gap-1.5
          border-t border-emerald-300/50 dark:border-emerald-400/10
          py-2.5 text-[11px] font-medium
          text-emerald-700 dark:text-emerald-300/80
          transition-colors
          hover:bg-emerald-500/5
          dark:hover:bg-emerald-400/5
        "
      >
        <ReceiptText className="h-3.5 w-3.5" />

        {showDetails ? "Hide invoice details" : "View invoice details"}

        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${
            showDetails ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {showDetails && (
          <motion.div
              key="invoice-details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-emerald-300/50 dark:border-emerald-400/10"
            >
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between text-[11px] text-emerald-700/70 dark:text-emerald-300/60">
                <span>Invoice {invoice?.number}</span>
                {createdAt && (
                  <span>
                    {new Date(createdAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              {invoice?.items?.length > 0 && (
                <div className="space-y-1.5 border-t border-emerald-300/50 pt-3 dark:border-emerald-400/10">
                  {invoice.items.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate font-medium text-emerald-950 dark:text-emerald-100">
                          {item.product_name ?? item.productName}
                        </p>
                        <p className="text-[11px] text-emerald-700/70 dark:text-emerald-300/60">
                          {item.color ?? ""} · {item.size} × {item.quantity}
                        </p>
                      </div>
                      <span className="shrink-0 tabular-nums text-emerald-950 dark:text-emerald-100">
                        {invoice?.amount?.currency?.symbol} {item.subtotal}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 border-t border-emerald-300/50 pt-3 text-sm dark:border-emerald-400/10">
                <div className="flex justify-between text-emerald-300/70">
                  <span>Subtotal</span>
                  <span className="tabular-nums text-emerald-700 dark:text-green-400">
                    {invoice?.amount?.currency?.symbol}{" "}
                    {invoice?.amount?.subtotal}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-300/70">
                  <span>Shipping</span>
                  <span className="tabular-nums text-emerald-700 dark:text-green-400">
                    {Number(invoice?.amount?.shipping) === 0
                      ? "Free"
                      : `${invoice?.amount?.currency?.symbol} ${invoice?.amount?.shipping}`}
                  </span>
                </div>
                {Number(invoice?.amount?.platform_fee) > 0 && (
                  <div className="flex justify-between text-emerald-300/70">
                    <span>Platform Fee</span>
                    <span className="tabular-nums text-emerald-700 dark:text-green-400">
                      {invoice?.amount?.currency?.symbol}{" "}
                      {invoice?.amount?.platform_fee}
                    </span>
                  </div>
                )}
                {Number(invoice?.amount?.tax) > 0 && (
                  <div className="flex justify-between text-emerald-300/70">
                    <span>Tax</span>
                    <span className="tabular-nums text-emerald-700 dark:text-green-400">
                      {invoice?.amount?.currency?.symbol}{" "}
                      {invoice?.amount?.tax}
                    </span>
                  </div>
                )}
                {Number(invoice?.amount?.discount) > 0 && (
                  <div className="flex justify-between text-emerald-300/70">
                    <span>Discount</span>
                    <span className="tabular-nums text-emerald-700 dark:text-green-400">
                      − {invoice?.amount?.currency?.symbol}{" "}
                      {invoice?.amount?.discount}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-emerald-300/50 pt-1.5 text-sm font-semibold dark:border-emerald-400/10">
                  <span className="text-emerald-950 dark:text-emerald-100">Total</span>
                  <span className="tabular-nums text-emerald-950 dark:text-emerald-100">
                    {invoice?.amount?.currency?.symbol} {invoice?.amount?.total}
                  </span>
                </div>
              </div>

              {invoice?.payment?.instructions && (
                <div className="border-t border-emerald-300/50 pt-3 dark:border-emerald-400/10">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-700/70 dark:text-emerald-300/60">
                    Instructions
                  </p>

                  <p className="mt-1 text-sm leading-relaxed text-emerald-900 dark:text-emerald-200/80">
                    {invoice.payment.instructions}
                  </p>
                </div>
              )}

              {invoice?.payment?.note && (
                <p className="text-[11px] text-emerald-700/70 dark:text-emerald-300/60">
                  {invoice.payment.note}
                </p>
              )}

              {expiresAt && (
                <p className="text-[11px] text-emerald-700/60 dark:text-emerald-300/50">
                  Invoice expires at{" "}
                  {new Date(expiresAt).toLocaleString()}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
