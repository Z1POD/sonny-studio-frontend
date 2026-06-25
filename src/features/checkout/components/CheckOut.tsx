// src/features/checkout/components/CheckOut.tsx
/**
 * CheckOut.tsx — v3
 *
 * 4-step full-page checkout wizard.
 * Supports mockup carousel in review step with all captured angles.
 * Sticky action buttons at bottom.
 * Passes mockupUrls to StepReview for carousel.
 */

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useCheckoutStore } from "../store";
import { StepVariantQuantity } from "./StepVariantQuantity";
import { StepShipping } from "./StepShipping";
import { StepReview } from "./StepReview";
import { StepPayment } from "./StepPayment";
import type { CheckoutStep } from "../types";

const STEPS: { id: CheckoutStep; label: string }[] = [
  { id: "variants", label: "Variants" },
  { id: "shipping", label: "Shipping" },
  { id: "review", label: "Review" },
  { id: "payment", label: "Payment" },
];

interface CheckOutProps {
  mockupUrls?: string[];
}

export function CheckOut({ mockupUrls = [] }: CheckOutProps) {
  const {
    isOpen,
    step,
    direction,
    productName,
    variants,
    mockupUrl,
    goBack,
    goForward,
    saveDraft,
    reset,
  } = useCheckoutStore();

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && step !== "payment") {
        if (step === "variants") {
          reset();
        } else {
          goBack();
        }
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, step, goBack, reset]);

  const handleSaveDraft = useCallback(() => {
    saveDraft();
    toast.success("Draft saved. You can continue later.");
  }, [saveDraft]);

  const handleClose = useCallback(() => {
    if (step === "payment" && window.confirm("Your order is in progress. Close anyway?")) {
      reset();
    } else if (step !== "payment") {
      reset();
    }
  }, [step, reset]);

  const currentStepIdx = STEPS.findIndex((s) => s.id === step);

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-border bg-surface/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-semibold leading-tight">{productName || "Checkout"}</h1>
            <p className="text-[11px] text-muted-foreground">
              Step {currentStepIdx + 1} of {STEPS.length}: {STEPS[currentStepIdx]?.label}
            </p>
          </div>
        </div>
      </header>

      {/* ─── Step Progress ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 px-4 py-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center gap-1.5">
            <div
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= currentStepIdx ? "bg-foreground" : "bg-border"
              }`}
            />
          </div>
        ))}
      </div>

        <div>
            {step !== "variants" ? (
            <button
              onClick={goBack}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      {/* ─── Step Content ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-[600px] px-2 sm:px-6">
          <AnimatePresence mode="wait" custom={direction}>
            {step === "variants" && (
              <motion.div
                key="variants"
                custom={direction}
                initial={{ x: direction > 0 ? 60 : -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction > 0 ? -60 : 60, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex h-full flex-col py-4"
              >
                <StepVariantQuantity variants={variants} onContinue={goForward} />
              </motion.div>
            )}

            {step === "shipping" && (
              <motion.div
                key="shipping"
                custom={direction}
                initial={{ x: direction > 0 ? 60 : -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction > 0 ? -60 : 60, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex h-full flex-col py-4"
              >
                <StepShipping onContinue={goForward} />
              </motion.div>
            )}

            {step === "review" && (
              <motion.div
                key="review"
                custom={direction}
                initial={{ x: direction > 0 ? 60 : -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction > 0 ? -60 : 60, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex h-full flex-col py-4"
              >
                <StepReview mockupUrl={mockupUrl} mockupUrls={mockupUrls} onContinue={goForward} />
              </motion.div>
            )}

            {step === "payment" && (
              <motion.div
                key="payment"
                custom={direction}
                initial={{ x: direction > 0 ? 60 : -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction > 0 ? -60 : 60, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="flex h-full flex-col py-4"
              >
                <StepPayment />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}