// src/features/checkout/components/StepReview.tsx

import { useMemo, useRef } from "react";
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
import { useQuery } from "@tanstack/react-query";
import { checkoutApi } from "../api";
import { buildCheckoutBody, resolveCurrencyId } from "../body";
import { formatPrice } from "@/lib/format";
import { ApiError } from "@/shared/api/client";
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
    cities,
    currencySymbol,
    setOrder,
    setCreatingOrder,
    creatingOrder,
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    goBack,
    getOrderItems,
    getTotalQuantity,
  } = useCheckoutStore();

  const clearCart = useCart((s) => s.clear);

  const isCartOrigin = origin === "cart";
  const totalQty = getTotalQuantity();

  // One idempotency key per distinct order request; reused when the same request is retried.
  const idem = useRef({ sig: "", key: "" });

  const primaryMockup = useMemo(
  () => mockupUrls[0] ?? mockupUrl ?? null,
    [mockupUrls, mockupUrl],
  );

  const selectedItems = useMemo(() => {
    if (isCartOrigin) {
      return cartItems.map((line) => ({
        key: `${line.designId}:${line.variantId}`,
        designId: line.designId,
        variantId: line.variantId,
        title: line.title,
        thumbnailUrl: line.thumbnailUrl,
        colorHex: line.colorHex,
        colorName: line.colorName,
        size: line.size,
        quantity: line.quantity,
      }));
    }
    const items: Array<{
      key: string; designId: string; variantId: string; title: string; thumbnailUrl?: string; colorHex: string; colorName: string;
      size: string; quantity: number;
    }> = [];
    for (const sel of selectedVariants.values()) {
      const variant = variants.find((v) => v.id === sel.variantId);
      if (variant) {
        items.push({
          key: variant.id,
          designId: useCheckoutStore.getState().productId,
          variantId: variant.id,
          title: productName,
          thumbnailUrl: undefined,
          colorHex: variant.color.hex,
          colorName: variant.color.name,
          size: variant.size,
          quantity: sel.quantity,
        });
      }
    }
    return items;
  }, [isCartOrigin, cartItems, selectedVariants, variants, productName]);

  // Totals come from the server (`POST /orders/checkout/validate/`) — never computed here.
  const orderItems = getOrderItems();
  const body = useMemo(
    () =>
      buildCheckoutBody({
        items: orderItems,
        shippingAddress,
        fulfillmentType,
        selectedVendorCode,
        selectedPickupId,
        shippingOptions,
        cities,
        currencyId: undefined,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orderItems.length, JSON.stringify(orderItems.map((i) => [i.designId, i.variantId, i.quantity])), shippingAddress, fulfillmentType, selectedVendorCode, selectedPickupId, shippingOptions, cities],
  );
  const quoteQ = useQuery({
    queryKey: ["checkout-quote", body],
    queryFn: async () => checkoutApi.validate({ ...body!, currency_id: await resolveCurrencyId() }),
    enabled: !!body,
    staleTime: 30_000,
    retry: false,
  });
  const quote = quoteQ.data;
  const cur = quote?.currency ?? { code: "", symbol: currencySymbol, decimal_places: 2 };
  const money = (v?: string) => (v == null ? "—" : formatPrice(v, cur));
  const lineTotalOf = (designId: string, variantId: string) =>
    quote?.lines.find((l) => l.designId === designId && l.variantId === variantId)?.lineTotal;
  const quoteError = quoteQ.error instanceof Error ? quoteQ.error.message : null;

  const selectedDelivery = shippingOptions?.delivery.find((d) => d.vendorCode === selectedVendorCode);
  const selectedPickup = shippingOptions?.pickup.find((p) => p.locationId === selectedPickupId);

  const handlePlaceOrder = async () => {
    setCreatingOrder(true);
    setFieldErrors({});

    try {
      if (!body) throw new Error("Choose a delivery option first");
      // Same request → same key (safe retries); a changed request gets a fresh key.
      const sig = JSON.stringify(body);
      if (idem.current.sig !== sig) idem.current = { sig, key: crypto.randomUUID() };
      const order = await checkoutApi.createOrder({ ...body, currency_id: await resolveCurrencyId() }, idem.current.key);

      setOrder(order);
      if (isCartOrigin) clearCart();
      haptics.impactOccurred('light');
      onContinue();
    } catch (e: any) {
      if (e instanceof ApiError && e.fields && Object.keys(e.fields).length > 0) {
        // Field-level problems (e.g. pickup_location_id) belong on the shipping step.
        toast.error(e.message || "Please review your delivery details");
        goBack();
      } else {
        toast.error(e?.message ?? "Failed to create order");
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
                {money(lineTotalOf(item.designId, item.variantId))}
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
            
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal ({totalQty} item{totalQty !== 1 ? "s" : ""})</span>
              <span className="tabular-nums text-foreground">{quoteQ.isLoading ? "…" : money(quote?.subtotal)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping</span>
              <span className="tabular-nums text-foreground">
                {quoteQ.isLoading ? "…" : quote ? (parseFloat(quote.shipping) === 0 ? "Free" : money(quote.shipping)) : "—"}
              </span>
            </div>
            {quote && parseFloat(quote.discount) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span className="tabular-nums text-green-600">-{money(quote.discount)}</span>
              </div>
            )}
            {quote && parseFloat(quote.tax) > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span className="tabular-nums text-foreground">{money(quote.tax)}</span>
              </div>
            )}
            {quoteError && (
              <p className="flex items-center gap-1 text-[11px] text-destructive">
                <AlertCircle className="h-3 w-3" />
                {quoteError}
              </p>
            )}
            <div className="border-t border-border/40 pt-2">
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{quoteQ.isLoading ? "…" : money(quote?.total)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Prices and delivery are calculated by our server.
              </p>
            </div>
          </div>
        </div>

        {/* Security note */}
        <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-[11px] text-green-700">
          <Shield className="h-3.5 w-3.5 flex-shrink-0" />
          <span>Pay by bank transfer or mobile money, then upload your receipt to verify.</span>
        </div>
      </div>

      {/* Sticky Place Order Button */}
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <Button
          onClick={handlePlaceOrder}
          disabled={creatingOrder || !quote}
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
              Place order{quote ? ` · ${money(quote.total)}` : ""}
              <ChevronRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}