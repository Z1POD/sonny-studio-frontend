// src/features/checkout/components/StepShipping.tsx

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/features/auth/store";
import {
  Truck,
  MapPin,
  User,
  Phone,
  Home,
  StickyNote,
  ChevronRight,
  Loader2,
  AlertCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCheckoutStore } from "../store";
import { checkoutApi } from "../api";
import type { FulfillmentType } from "../types";
import { haptics } from "@/shared/lib/haptics";

interface Props {
  onContinue: () => void;
}


const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -60 : 60,
    opacity: 0,
  }),
};

const ETH_PHONE_RE = /^\+251[79]\d{8}$/;

const normalizePhone = (phone: string) => {
  let p = phone.trim().replace(/[\s-]/g, "");

  // 09XXXXXXXX or 07XXXXXXXX → 9XXXXXXXX or 7XXXXXXXX
  if (p.startsWith("09") || p.startsWith("07")) {
    p = p.substring(1);
  }

  // 9XXXXXXXX or 7XXXXXXXX → convert to +251
  if (/^[79]\d{8}$/.test(p)) {
    p = "+251" + p;
  }

  // 00251... → +251...
  if (p.startsWith("00251")) {
    p = "+251" + p.slice(5);
  }

  return p;
};

function validatePhone(phone: string): { valid: boolean; message?: string } {
  const trimmed = phone.trim();
  if (!trimmed) return { valid: false, message: "Phone number is required" };

  const normalized = normalizePhone(trimmed);

  if (!ETH_PHONE_RE.test(normalized)) {
    return {
      valid: false,
      message: "Enter a valid Ethiopian phone (09..., 07..., or +251...)",
    };
  }

  return { valid: true };
}

function validateName(name: string): { valid: boolean; message?: string } {
  const trimmed = name.trim();
  if (!trimmed) return { valid: false, message: "Full name is required" };
  if (trimmed.length < 2) return { valid: false, message: "Name must be at least 2 characters" };
  if (trimmed.length > 200) return { valid: false, message: "Name must be under 200 characters" };
  return { valid: true };
}

function validateStreet(street: string): { valid: boolean; message?: string } {
  const trimmed = street.trim();
  if (!trimmed) return { valid: false, message: "Street address is required" };
  if (trimmed.length < 3) return { valid: false, message: "Street address too short" };
  if (trimmed.length > 500) return { valid: false, message: "Street address too long" };
  return { valid: true };
}

export function StepShipping({ onContinue }: Props) {
  const user = useAuthStore((s) => s.user);
  const {
    shippingAddress,
    setShippingAddress,
    fulfillmentType,
    setFulfillmentType,
    selectedVendorCode,
    setSelectedVendorCode,
    selectedPickupId,
    setSelectedPickupId,
    cities,
    setCities,
    citiesLoading,
    setCitiesLoading,
    shippingOptions,
    setShippingOptions,
    shippingLoading,
    setShippingLoading,
    couponCode,
    setCouponCode,
    fieldErrors,
    setFieldErrors,
    clearFieldError,
    getTotalQuantity,
    getSubtotal,
  } = useCheckoutStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      user?.display_name &&
      !shippingAddress.fullName.trim()
    ) {
      setShippingAddress({
        fullName: user.display_name,
      });
    }
  }, [
    user?.display_name,
    shippingAddress.fullName,
    setShippingAddress,
  ]);

  // Fetch cities on mount
  useEffect(() => {
    if (cities.length > 0) return;
    setCitiesLoading(true);
    checkoutApi
      .getCities()
      .then(setCities)
      .catch(() => setFieldErrors({ city: "Failed to load cities" }))
      .finally(() => setCitiesLoading(false));
  }, [cities.length, setCities, setCitiesLoading, setFieldErrors]);

  // Fetch shipping options when city changes
  useEffect(() => {
    if (!shippingAddress.cityId) {
      setShippingOptions(null);
      return;
    }
    const qty = getTotalQuantity();
    const subtotal = getSubtotal();
    setShippingLoading(true);
    checkoutApi
      .getShippingOptions(shippingAddress.cityId, qty, subtotal)
      .then((opts) => {
        setShippingOptions(opts);
        if (opts.delivery.length > 0 && !selectedVendorCode) {
          setSelectedVendorCode(opts.delivery[0].vendorCode);
        } else if (opts.pickup.length > 0 && !selectedPickupId) {
          setSelectedPickupId(opts.pickup[0].locationId);
        }
      })
      .catch(() => setFieldErrors({ vendor: "Failed to load shipping options" }))
      .finally(() => setShippingLoading(false));
  }, [shippingAddress.cityId, getSubtotal, getTotalQuantity, setShippingOptions, setShippingLoading, setFieldErrors, setSelectedVendorCode, setSelectedPickupId, selectedVendorCode, selectedPickupId]);

  const nameValidation = validateName(shippingAddress.fullName);

    const phoneValidation =
    fulfillmentType === "delivery"
        ? validatePhone(shippingAddress.phone)
        : { valid: true };

    const streetValidation =
    fulfillmentType === "delivery"
        ? validateStreet(shippingAddress.street)
        : { valid: true };

  const hasSelectedShipping =
    fulfillmentType === "delivery" ? !!selectedVendorCode : !!selectedPickupId;

  // FIXED: Proper validation logic for continue button
  const canContinue =
  !shippingLoading &&
  !!shippingAddress.cityId &&
  nameValidation.valid &&
  hasSelectedShipping &&
  phoneValidation.valid &&
  streetValidation.valid;

  const handleContinue = () => {
    const errors: typeof fieldErrors = {};
    if (!nameValidation.valid) errors.fullName = nameValidation.message;
    if (!shippingAddress.cityId) errors.city = "Please select a city";
    if (fulfillmentType === "delivery") {
      if (!phoneValidation.valid) errors.phone = phoneValidation.message;
      if (!streetValidation.valid) errors.street = streetValidation.message;
      if (!selectedVendorCode) errors.vendor = "Please select a delivery option";
    } else {
      if (!selectedPickupId) errors.pickupLocation = "Please select a pickup location";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    onContinue();
  };

    const selectedCity = cities.find((c) => c.id === shippingAddress.cityId);


  return (
    <motion.div
      custom={1}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      ref={scrollRef}
      className="flex h-full flex-col overflow-y-auto px-0 sm:px-2 no-scrollbar"
    >
      {/* Scrollable content */}
      <div className="flex-1 space-y-4">
        {/* Full Name */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <User className="h-3 w-3" />
            Full name
          </Label>
          <Input
            value={shippingAddress.fullName}
            onChange={(e) => {
                const value = e.target.value;

                setShippingAddress({
                fullName: value,
                });

                clearFieldError("fullName");
            }}
            placeholder="Henok Tesfaye"
            className={`h-12 rounded-xl border-border bg-surface ${
                shippingAddress.fullName &&
                !nameValidation.valid
                ? "border-destructive"
                : ""
            }`}
            />

            {shippingAddress.fullName.length > 0 &&
            !nameValidation.valid && (
                <p className="flex items-center gap-1 text-[11px] text-destructive">
                <AlertCircle className="h-3 w-3" />
                {nameValidation.message}
                </p>
            )}
        </div>

        {/* City Selection */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            City
          </Label>
          {citiesLoading ? (
            <div className="flex h-12 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading cities…
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cities.map((city) => (
                <button
                  key={city.id}
                  onClick={() => {
                    setShippingAddress({ cityId: city.id, cityName: city.name, state: city.state });
                    clearFieldError("city");
                    haptics.impactOccurred("light")
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                    shippingAddress.cityId === city.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-surface text-foreground hover:border-foreground/40"
                  }`}
                >
                  {city.name}
                </button>
              ))}
            </div>
          )}
          {fieldErrors.city && (
            <p className="flex items-center gap-1 text-[11px] text-destructive">
              <AlertCircle className="h-3 w-3" />
              {fieldErrors.city}
            </p>
          )}
        </div>

        {/* Fulfillment Type Toggle */}
        {selectedCity && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-surface p-1">
              {(["delivery", "pickup"] as FulfillmentType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setFulfillmentType(type);
                    if (type === "pickup") {
                        clearFieldError("phone");
                        clearFieldError("street");
                    }
                    clearFieldError("vendor");
                    clearFieldError("pickupLocation");
                    haptics.impactOccurred("light")
                  }}
                  className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
                    fulfillmentType === type
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {type === "delivery" ? <Truck className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                  {type === "delivery" ? "Delivery" : "Pickup"}
                </button>
              ))}
            </div>

            {/* Delivery Options */}
            {fulfillmentType === "delivery" && shippingOptions && (
              <div className="space-y-2">
                {shippingLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading options…
                  </div>
                ) : (
                  shippingOptions.delivery.map((opt) => (
                    <button
                      key={opt.vendorCode}
                      onClick={() => {
                        setSelectedVendorCode(opt.vendorCode);
                        clearFieldError("vendor");
                      }}
                      className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                        selectedVendorCode === opt.vendorCode
                          ? "border-primary bg-primary/5"
                          : "border-border bg-surface hover:border-foreground/30"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium">{opt.vendorName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {opt.serviceName} · {opt.estimatedDays}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {opt.isFree ? "Free" : `${opt.currency} ${opt.cost}`}
                        </p>
                      </div>
                    </button>
                  ))
                )}
                {fieldErrors.vendor && (
                  <p className="flex items-center gap-1 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {fieldErrors.vendor}
                  </p>
                )}

                {/* Delivery-specific fields */}
                <div className="mt-2 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      Phone
                    </Label>
                    <Input
                        value={shippingAddress.phone}
                        onChange={(e) => {
                            setShippingAddress({
                            phone: e.target.value,
                            });

                            clearFieldError("phone");
                        }}
                        placeholder="+251911234567"
                        className={`h-12 rounded-xl border-border bg-surface ${
                            shippingAddress.phone &&
                            !phoneValidation.valid
                            ? "border-destructive"
                            : ""
                        }`}
                        />

                        {shippingAddress.phone.length > 0 &&
                        !phoneValidation.valid && (
                            <p className="flex items-center gap-1 text-[11px] text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            {phoneValidation.message}
                            </p>
                        )}

                        {shippingAddress.phone.length > 0 &&
                        phoneValidation.valid && (
                            <p className="flex items-center gap-1 text-[11px] text-green-600">
                            <Check className="h-3 w-3" />
                            Phone number
                            </p>
                        )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      <Home className="h-3 w-3" />
                      Street address
                    </Label>
                    <Input
                        value={shippingAddress.street}
                        onChange={(e) => {
                            setShippingAddress({
                            street: e.target.value,
                            });

                            clearFieldError("street");
                        }}
                        placeholder="Bole Road, House 123"
                        className={`h-12 rounded-xl border-border bg-surface ${
                            shippingAddress.street &&
                            !streetValidation.valid
                            ? "border-destructive"
                            : ""
                        }`}
                        />

                        {shippingAddress.street.length > 0 &&
                        !streetValidation.valid && (
                            <p className="flex items-center gap-1 text-[11px] text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            {streetValidation.message}
                            </p>
                        )}
                  </div>
                </div>
              </div>
            )}

            {/* Pickup Options */}
            {fulfillmentType === "pickup" && shippingOptions && (
              <div className="space-y-2">
                {shippingLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading options…
                  </div>
                ) : (
                  shippingOptions.pickup.map((loc) => (
                    <button
                      key={loc.locationId}
                      onClick={() => {
                        setSelectedPickupId(loc.locationId);
                        clearFieldError("pickupLocation");
                      }}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                        selectedPickupId === loc.locationId
                          ? "border-primary bg-primary/5"
                          : "border-border bg-surface hover:border-foreground/30"
                      }`}
                    >
                      <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{loc.name}</p>
                        <p className="text-[11px] text-muted-foreground">{loc.address}</p>
                        {loc.landmark && (
                          <p className="text-[11px] text-muted-foreground">Near {loc.landmark}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground">{loc.estimatedDays}</p>
                      </div>
                    </button>
                  ))
                )}
                {fieldErrors.pickupLocation && (
                  <p className="flex items-center gap-1 text-[11px] text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    {fieldErrors.pickupLocation}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Order Note */}
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <StickyNote className="h-3 w-3" />
            Order note (optional)
          </Label>
          <Input
            value={shippingAddress.deliveryInstructions ?? ""}
            onChange={(e) => setShippingAddress({ deliveryInstructions: e.target.value })}
            placeholder="Any special instructions…"
            className="h-12 rounded-xl border-border bg-surface"
          />
        </div>

        {/* Coupon */}
        <div className="space-y-1.5 mb-2">
          <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Coupon code (optional)
          </Label>
          <Input
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value);
              clearFieldError("coupon");
            }}
            placeholder="SAVE10"
            className={`h-12 rounded-xl border-border bg-surface ${fieldErrors.coupon ? "border-destructive" : ""}`}
          />
          {fieldErrors.coupon && (
            <p className="flex items-center gap-1 text-[11px] text-destructive">
              <AlertCircle className="h-3 w-3" />
              {fieldErrors.coupon}
            </p>
          )}
        </div>
      </div>

      {/* Sticky Continue Button */}
      <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full h-12 rounded-2xl text-base font-semibold"
          size="lg"
        >
          Continue
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}