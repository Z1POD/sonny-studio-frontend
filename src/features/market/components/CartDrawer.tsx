// src/features/market/components/CartDrawer.tsx

import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCart } from "../store";
import { useAuthStore } from "@/features/auth/store";
import { useCheckoutStore } from "@/features/checkout/store";
import { formatPrice } from "@/lib/format";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export function CartDrawer() {
  const open = useCart((s) => s.drawerOpen);
  const close = useCart((s) => s.closeDrawer);
  const items = useCart((s) => s.items);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const subtotal = useCart((s) => s.subtotal());
  const user = useAuthStore((s) => s.user);
  // const openAuth = useAuthStore((s) => s.openSheet);
  const navigate = useNavigate();

  const startCheckoutFromCart = useCheckoutStore((s) => (s as any).startCheckoutFromCart);

  const currency = items[0]?.currency;

  const onCheckout = () => {
    if (!user) {
      close();
      navigate({ to: "/login" });
      toast("Sign in to continue checkout");
      return;
    }

    startCheckoutFromCart(
      items.map((i) => ({
        productId: i.product_id,
        title: i.title,
        thumbnailUrl: i.mockup_url ?? i.thumbnail_url,
        colorName: i.color_name,
        colorHex: i.color_hex,
        size: i.size,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        currencySymbol: i.currency.symbol,
      })),
    );
    close();
  };

  return (
    <Drawer open={open} onOpenChange={(o) => (o ? null : close())}>
      <DrawerContent className="border-border bg-background">
        <DrawerHeader className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <DrawerTitle className="text-lg tracking-tight">Your bag</DrawerTitle>
            <DrawerDescription className="text-xs text-muted-foreground">
              {items.length} {items.length === 1 ? "item" : "items"}
            </DrawerDescription>
          </div>
          <button onClick={close} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </DrawerHeader>

        <div className="max-h-[55dvh] overflow-y-auto px-4 py-4 md:px-6">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
                <ShoppingBag className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Your bag is empty.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.cart_id}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-3"
                >
                  {item.mockup_url ? (
                    <img
                      src={item.mockup_url}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
                    />
                  ) : (
                    <div
                      className="h-16 w-16 shrink-0 rounded-xl border border-border"
                      style={{ background: item.color_hex }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground"> 
                        {item.color_name} · {item.size}
                      </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => setQty(item.cart_id, item.quantity - 1)}
                        className="grid h-6 w-6 place-items-center rounded-full border border-border hover:bg-muted"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-xs tabular-nums">{item.quantity}</span>
                      <button
                        onClick={() => setQty(item.cart_id, item.quantity + 1)}
                        className="grid h-6 w-6 place-items-center rounded-full border border-border hover:bg-muted"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatPrice(item.unit_price * item.quantity, item.currency)}
                    </p>
                    <button
                      onClick={() => remove(item.cart_id)}
                      aria-label="Remove"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border bg-surface/60 px-4 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-4 md:px-6">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Subtotal</span>
            <span className="text-lg font-semibold tabular-nums">{formatPrice(subtotal, currency)}</span>
          </div>
          <button
            onClick={onCheckout}
            disabled={items.length === 0}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-gold font-semibold text-gold-foreground transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Checkout · {formatPrice(subtotal, currency)}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Bank transfer · Receipt verified within minutes
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}