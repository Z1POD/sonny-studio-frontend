// src/features/checkout/components/StepReview.tsx
/**
 * StepReview.tsx — v3
 * Multi-variant support, correct price calculation with print cost,
 * mockup carousel with all captured images.
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Truck,
  MapPin,
  User,
  Phone,
  Home,
  CreditCard,
  ChevronRight,
  Loader2,
  Shield,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCheckoutStore } from "../store";
import { orderApi } from "../api";
import { toast } from "sonner";

interface Props {
  mockupUrl?: string;
  mockupUrls?: string[]; // All captured mockup images
  onContinue: () => void;
}

export function StepReview({ mockupUrl, mockupUrls = [], onContinue }: Props) {
  const {
    productName,
    variants,
    selectedVariants,
    artworks,
    printAreas,
    shippingAddress,
    fulfillmentType,
    selectedVendorCode,
    selectedPickupId,
    shippingOptions,
    couponCode,
    basePrice,
    printCost,
    currencySymbol,
    setOrder,
    setCreatingOrder,
    creatingOrder,
    setFieldErrors,
    getOrderItems,
    getTotalQuantity,
  } = useCheckoutStore();

  const [mockupIndex, setMockupIndex] = useState(0);

  const totalQty = getTotalQuantity();

  // Build mockup slides from all captured shots
  const mockupSlides = useMemo(() => {
    const slides: string[] = [];
    if (mockupUrls.length > 0) {
      slides.push(...mockupUrls);
    } else if (mockupUrl) {
      slides.push(mockupUrl);
    }
    return slides;
  }, [mockupUrl, mockupUrls]);

  // Get selected variant details
  const selectedItems = useMemo(() => {
    const items: Array<{ variant: typeof variants[0]; quantity: number }> = [];
    for (const sel of selectedVariants.values()) {
      const variant = variants.find((v) => v.id === sel.variantId);
      if (variant) items.push({ variant, quantity: sel.quantity });
    }
    return items;
  }, [selectedVariants, variants]);

  // Calculate prices correctly with print cost
  const { unitPrice, subtotal, shippingCost, total } = useMemo(() => {
    const unit = basePrice + printCost;
    const sub = unit * totalQty;
    let ship = 0;
    if (fulfillmentType === "delivery" && shippingOptions) {
      const opt = shippingOptions.delivery.find((d) => d.vendorCode === selectedVendorCode);
      if (opt && !opt.isFree) ship = parseFloat(opt.cost);
    }
    return { unitPrice: unit, subtotal: sub, shippingCost: ship, total: sub + ship };
  }, [basePrice, printCost, totalQty, fulfillmentType, shippingOptions, selectedVendorCode]);

  const selectedDelivery = shippingOptions?.delivery.find((d) => d.vendorCode === selectedVendorCode);
  const selectedPickup = shippingOptions?.pickup.find((p) => p.locationId === selectedPickupId);

  const handlePlaceOrder = async () => {
    setCreatingOrder(true);
    setFieldErrors({});

    try {
      const items = getOrderItems();
      const isDelivery = fulfillmentType === "delivery";

      const order = await orderApi.create({
        items: items.map((i) => ({
          product_id: i.productId,
          size: i.size,
          color_name: i.colorName,
          quantity: i.quantity,
        })),
        delivery_type: fulfillmentType,
        shipping_address: isDelivery
          ? {
              full_name: shippingAddress.fullName,
              phone: shippingAddress.phone,
              street: shippingAddress.street,
              city_id: shippingAddress.cityId,
              state: shippingAddress.state,
              postal_code: shippingAddress.postalCode,
              delivery_instructions: shippingAddress.deliveryInstructions,
            }
          : undefined,
        shipping_vendor: isDelivery ? selectedDelivery?.vendorCode : undefined,
        shipping_service_level: isDelivery
          ? selectedDelivery?.serviceLevel
          : undefined,
        pickup_location_id: !isDelivery ? selectedPickupId : undefined,
        coupon_code: couponCode.trim(),
        customer_note: shippingAddress.deliveryInstructions,
        currency: currencySymbol === "Br" ? "ETB" : currencySymbol,
      });

      setOrder(order);
      onContinue();
    } catch (e: any) {
      const msg = e?.message ?? "Failed to create order";
      toast.error(msg);
      console.error(e);
    } finally {
      setCreatingOrder(false);
    }
  };

  const activePrintAreas = printAreas.filter((p) => artworks[p.id]?.decalUrl);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full flex-col"
    >
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-28 px-2 no-scrollbar">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-2xl font-semibold tracking-tight">Review your order</h2>
          <p className="mt-1 text-sm text-muted-foreground">Double-check everything before placing.</p>
        </div>

        {/* Mockup Carousel */}
        {mockupSlides.length > 0 && (
          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="relative aspect-[4/3] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.img
                  key={mockupIndex}
                  src={mockupSlides[mockupIndex]}
                  alt={`${productName} — view ${mockupIndex + 1}`}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="h-full w-full object-contain"
                />
              </AnimatePresence>

              {/* Carousel Controls */}
              {mockupSlides.length > 1 && (
                <>
                  <button
                    onClick={() => setMockupIndex((i) => (i - 1 + mockupSlides.length) % mockupSlides.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setMockupIndex((i) => (i + 1) % mockupSlides.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                  {/* Dots */}
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                    {mockupSlides.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setMockupIndex(i)}
                        className={`h-1.5 rounded-full transition-all ${
                          i === mockupIndex ? "w-4 bg-white" : "w-1.5 bg-white/40"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Image counter */}
              {mockupSlides.length > 1 && (
                <div className="absolute top-3 right-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
                  {mockupIndex + 1} / {mockupSlides.length}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Item Summary */}
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Items</h3>
            <span className="text-[10px] text-muted-foreground">{totalQty} total</span>
          </div>

          {selectedItems.map(({ variant, quantity }) => (
            <div key={variant.id} className="flex items-center justify-between py-2 border-t border-border/40 first:border-t-0">
              <div className="flex items-center gap-3">
                <span
                  className="h-6 w-6 rounded-full border border-border/40"
                  style={{ backgroundColor: variant.color.hex }}
                />
                <div>
                  <p className="text-sm font-medium">{productName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {variant.color.name} · {variant.size} × {quantity}
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {currencySymbol} {(unitPrice * quantity).toFixed(2)}
              </span>
            </div>
          ))}

          {/* Print areas summary */}
          {activePrintAreas.length > 0 && (
            <div className="border-t border-border/40 pt-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-1.5">
                Custom artwork
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activePrintAreas.map((area) => (
                  <span
                    key={area.id}
                    className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {area.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Shipping Summary */}
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            {fulfillmentType === "delivery" ? (
              <Truck className="h-4 w-4 text-muted-foreground" />
            ) : (
              <MapPin className="h-4 w-4 text-muted-foreground" />
            )}
            <h3 className="text-sm font-semibold">Shipping</h3>
          </div>

          {fulfillmentType === "delivery" ? (
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-3.5 w-3.5" />
                <span>{shippingAddress.fullName}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                <span>{shippingAddress.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Home className="h-3.5 w-3.5" />
                <span>
                  {shippingAddress.street}, {shippingAddress.cityName}
                </span>
              </div>
              {selectedDelivery && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1.5 text-[11px]">
                  <Truck className="h-3 w-3" />
                  <span>
                    {selectedDelivery.vendorName} · {selectedDelivery.serviceName}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{selectedPickup?.name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pl-5.5">{selectedPickup?.address}</p>
            </div>
          )}
        </div>

        {/* Price Breakdown */}
        <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Price breakdown</h3>
            <span className="text-[10px] text-muted-foreground">(estimated)</span>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal ({totalQty} item{totalQty !== 1 ? "s" : ""})</span>
              <span className="tabular-nums text-foreground">{currencySymbol} {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping</span>
              <span className="tabular-nums text-foreground">
                {shippingCost === 0 ? "Free" : `${currencySymbol} ${shippingCost.toFixed(2)}`}
              </span>
            </div>
            {couponCode && (
              <div className="flex justify-between text-muted-foreground">
                <span>Coupon</span>
                <span className="tabular-nums text-green-600">{couponCode}</span>
              </div>
            )}
            <div className="border-t border-border/40 pt-2">
              <div className="flex justify-between text-base font-semibold">
                <span>Estimated total</span>
                <span className="tabular-nums">{currencySymbol} {total.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Final price will be confirmed by the store after order placement.
              </p>
            </div>
          </div>
        </div>

        {/* Security note */}
        <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-[11px] text-green-700">
          <Shield className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Your payment will be verified automatically within 1-2 minutes.</span>
        </div>
      </div>

      {/* Sticky Place Order Button */}
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <Button
          onClick={handlePlaceOrder}
          disabled={creatingOrder}
          className="w-full h-12 rounded-2xl text-base font-semibold"
          size="lg"
        >
          {creatingOrder ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating order…
            </>
          ) : (
            <>
              Place order · {currencySymbol} {total.toFixed(2)}
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}