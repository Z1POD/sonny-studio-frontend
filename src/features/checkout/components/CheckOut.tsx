// src/features/checkout/components/CheckOut.tsx — v5


import { useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { useCheckoutStore } from "../store";
import { StepVariantQuantity } from "./StepVariantQuantity";
import { StepShipping } from "./StepShipping";
import { StepReview } from "./StepReview";
import { StepPayment } from "./StepPayment";
import type { CheckoutStep } from "../types";
import { cn } from "@/lib/utils";


const ALL_STEPS: { id: CheckoutStep; label: string }[] = [
  { id: "variants", label: "Variants" },
  { id: "shipping", label: "Shipping" },
  { id: "review", label: "Review" },
  { id: "payment", label: "Payment" },
];

interface CheckOutProps {
  /**
   * Override mockup URLs for the review carousel.
   * Falls back to store.mockupUrls when absent (reorder flow uses CDN URLs).
   */
  mockupUrls?: string[];
}

export function CheckOut({ mockupUrls: mockupUrlsProp }: CheckOutProps) {
  const {
    isOpen,
    step,
    direction,
    productName,
    variants,
    mockupUrl,
    mockupUrls: storeMockupUrls,
    // `origin` is read defensively — if store.ts hasn't been updated with
    // it yet, this simply falls back to the existing Studio-only behavior.
    origin,
    goBack,
    goForward,
    saveDraft,
    reset,
  } = useCheckoutStore() as ReturnType<typeof useCheckoutStore> & { origin?: "studio" | "cart" };
  const { isTelegram } = useTelegram();

  const isCartOrigin = origin === "cart";


  // Cart-initiated checkout skips variant selection — it's already resolved
  // per line in the cart itself.
  const STEPS = useMemo(
    () => (isCartOrigin ? ALL_STEPS.filter((s) => s.id !== "variants") : ALL_STEPS),
    [isCartOrigin],
  );

  // Prefer prop (live captures from studio), fall back to store CDN URLs (reorder)
  const resolvedMockupUrls =
    mockupUrlsProp && mockupUrlsProp.length > 0 ? mockupUrlsProp : storeMockupUrls;

  const firstStepId = STEPS[0]?.id;
  const isFirstStep = step === firstStepId;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && step !== "payment") {
        isFirstStep ? reset() : goBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, step, isFirstStep, goBack, reset]);

  const handleClose = useCallback(() => {
    if (
      step === "payment" &&
      window.confirm("Your order is in progress. Close anyway?")
    ) {
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
      <header
        className={cn(
          "flex items-center gap-3 border-b border-border bg-surface/80 px-4 py-3 backdrop-blur-xl",
          isTelegram && "pt-[var(--tg-safe-area-top,0px)]"
        )}
      >
        {isFirstStep ? (
          <button
            onClick={handleClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        ) : step !== "payment" && !isTelegram ? (
          <button
            onClick={goBack}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-muted"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-tight">
            {productName || (isCartOrigin ? "Your bag" : "Checkout")}
          </h1>

          <p className="text-[11px] text-muted-foreground">
            Step {currentStepIdx + 1} of {STEPS.length}:{" "}
            {STEPS[currentStepIdx]?.label}
          </p>
        </div>
      </header>

      {/* Progress bar */}
      <div className="flex items-center gap-1 px-4 py-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex flex-1 items-center">
            <div
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= currentStepIdx ? "bg-foreground" : "bg-border"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-[600px] px-2 sm:px-6">
          <AnimatePresence mode="wait" custom={direction}>
            {step === "variants" && !isCartOrigin && (
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
                <StepReview
                  mockupUrl={mockupUrl}
                  mockupUrls={resolvedMockupUrls}
                  onContinue={goForward}
                />
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