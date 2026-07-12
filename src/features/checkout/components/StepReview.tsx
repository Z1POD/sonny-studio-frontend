// src/features/checkout/components/StepReview.tsx

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
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
  Palette,
  AlertCircle,
  X,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCheckoutStore } from "../store";
import { useCart } from "@/features/market/store";
import { orderApi, getFieldErrorsFromApiError } from "../api";
import { appToast as toast } from "@/lib/toaster";
import { haptics } from "@/shared/lib/haptics";

interface Props {
  mockupUrl?: string;
  mockupUrls?: string[]; // All captured mockup images
  onContinue: () => void;
}

export function StepReview({ mockupUrl, mockupUrls = [], onContinue }: Props) {
  const {
    origin,
    cartItems,
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
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    setCouponCode,
    goBack,
    getOrderItems,
    getTotalQuantity,
    getSubtotal,
  } = useCheckoutStore();

  const clearCart = useCart((s) => s.clear);

  const isCartOrigin = origin === "cart";
  const totalQty = getTotalQuantity();

  const [isEditingCoupon, setIsEditingCoupon] = useState(false);
  const [couponDraft, setCouponDraft] = useState(couponCode);

  useEffect(() => {
    if (fieldErrors.coupon) {
      setIsEditingCoupon(true);
      setCouponDraft(couponCode);
    }
  }, [fieldErrors.coupon]);

  const applyCouponDraft = () => {
    setCouponCode(couponDraft.trim());
    clearFieldError("coupon");
    setIsEditingCoupon(false);
  };

  const removeCoupon = () => {
    setCouponCode("");
    setCouponDraft("");
    clearFieldError("coupon");
    setIsEditingCoupon(false);
  };

  const primaryMockup = useMemo(
  () => mockupUrls[0] ?? mockupUrl ?? null,
    [mockupUrls, mockupUrl],
  );

  const selectedItems = useMemo(() => {
    if (isCartOrigin) {
      return cartItems.map((line) => ({
        key: `${line.productId}:${line.colorName}:${line.size}`,
        title: line.title,
        thumbnailUrl: line.thumbnailUrl,
        colorHex: line.colorHex,
        colorName: line.colorName,
        size: line.size,
        quantity: line.quantity,
        lineTotal: line.unitPrice * line.quantity,
      }));
    }
    const items: Array<{
      key: string; title: string; thumbnailUrl?: string; colorHex: string; colorName: string;
      size: string; quantity: number; lineTotal: number;
    }> = [];
    for (const sel of selectedVariants.values()) {
      const variant = variants.find((v) => v.id === sel.variantId);
      if (variant) {
        items.push({
          key: variant.id,
          title: productName,
          thumbnailUrl: undefined,
          colorHex: variant.color.hex,
          colorName: variant.color.name,
          size: variant.size,
          quantity: sel.quantity,
          lineTotal: (basePrice + printCost) * sel.quantity,
        });
      }
    }
    return items;
  }, [isCartOrigin, cartItems, selectedVariants, variants, productName, basePrice, printCost]);

  const { subtotal, shippingCost, total } = useMemo(() => {
    const sub = getSubtotal();
    let ship = 0;
    if (fulfillmentType === "delivery" && shippingOptions) {
      const opt = shippingOptions.delivery.find((d) => d.vendorCode === selectedVendorCode);
      if (opt && !opt.isFree) ship = parseFloat(opt.cost);
    }
    return { subtotal: sub, shippingCost: ship, total: sub + ship };
  }, [getSubtotal, fulfillmentType, shippingOptions, selectedVendorCode, totalQty]);

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
      if (isCartOrigin) clearCart();
      haptics.impactOccurred('light');
      onContinue();
    } catch (e: any) {
      const backendErrors = getFieldErrorsFromApiError(e);

      if (backendErrors.coupon) {
        setFieldErrors({ ...fieldErrors, coupon: backendErrors.coupon });
        setIsEditingCoupon(true);
        setCouponDraft(couponCode);
        toast.error(backendErrors.coupon);
      } else if (Object.keys(backendErrors).length > 0) {
        setFieldErrors(backendErrors);
        toast.error(e?.message ?? "Please review your shipping details");
        goBack();
      } else {
        const msg = e?.message ?? "Failed to create order";
        toast.error(msg);
      }
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



        {/* Item Summary */}
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">

          {primaryMockup && (
            <div className="flex items-center gap-5 border-b border-border/60 p-4">
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted/40">
                <img
                  src={primaryMockup}
                  alt={productName}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold tracking-tight">
                  {productName}
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  {totalQty} item{totalQty > 1 ? "s" : ""}
                </p>

                {activePrintAreas.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activePrintAreas.map((area) => (
                      <span
                        key={area.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                      >
                        <Palette className="h-3 w-3" />
                        {area.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Items</h3>
            </div>

          {selectedItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2 border-t border-border/40 first:border-t-0">
              <div className="flex items-center gap-3">
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="h-10 w-10 flex-shrink-0 rounded-lg border border-border/40 object-cover"
                  />
                ) : (
                  <span
                    className="h-6 w-6 flex-shrink-0 rounded-full border border-border/40"
                    style={{ backgroundColor: item.colorHex }}
                  />
                )}
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {item.colorName} · {item.size} × {item.quantity}
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {currencySymbol} {item.lineTotal.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
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
            {(couponCode || fieldErrors.coupon) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    <Tag className="h-3.5 w-3.5" />
                    Coupon
                  </span>

                  {isEditingCoupon ? (
                    <div className="flex flex-1 items-center justify-end gap-1.5">
                      <Input
                        autoFocus
                        value={couponDraft}
                        onChange={(e) => {
                          setCouponDraft(e.target.value);
                          if (fieldErrors.coupon) clearFieldError("coupon");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyCouponDraft();
                          }
                        }}
                        placeholder="Coupon code"
                        className={`h-8 max-w-[140px] rounded-lg border-border bg-surface text-xs ${
                          fieldErrors.coupon ? "border-destructive" : ""
                        }`}
                      />
                      <button
                        type="button"
                        onClick={applyCouponDraft}
                        disabled={!couponDraft.trim() || couponDraft.trim() === couponCode}
                        className="text-xs font-medium text-primary disabled:opacity-40"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        aria-label="Remove coupon"
                        className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-green-600">{couponCode}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCouponDraft(couponCode);
                          setIsEditingCoupon(true);
                        }}
                        className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        aria-label="Remove coupon"
                        className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                {fieldErrors.coupon && (
                  <p className="flex items-center gap-1 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {fieldErrors.coupon}
                  </p>
                )}
              </div>
            )}
            <div className="border-t border-border/40 pt-2">
              <div className="flex justify-between text-base font-semibold">
                <span>Estimated total</span>
                <span className="tabular-nums">{currencySymbol} {total.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Final price will be confirmed on payment after order placement.
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