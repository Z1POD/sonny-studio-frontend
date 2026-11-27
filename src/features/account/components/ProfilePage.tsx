// src/features/account/components/ProfilePage.tsx
//
// Account management: details, currency, notification preferences, saved addresses, recent orders.

"use client";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Loader2, LogOut, MapPin, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BrandLoader } from "@/components/ui/loader";
import { appToast as toast } from "@/lib/toaster";
import { formatDate } from "@/lib/format";
import { useConfirm } from "@/shared/components/ConfirmModal";
import { useAuthStore } from "@/features/auth/store";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { UserAvatar } from "@/shared/components/UserAvatar";
import { authApi } from "@/features/auth/api";
import { ordersQuery } from "@/features/orders/queries";
import { ORDER_STATUS_LABEL } from "@/features/orders/api";
import { accountApi, type Address, type AddressInput } from "../api";
import { accountKeys, addressesQuery, currenciesQuery } from "../queries";
import { NotificationPrefsCard } from "./NotificationPrefsCard";

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const EMPTY_ADDRESS: AddressInput = {
  label: "", full_name: "", phone: "", line1: "", line2: "", city: "", state: "", postal_code: "", country_code: "ET",
};

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { isTelegram } = useTelegram();
  const qc = useQueryClient();
  const [confirm, confirmModal] = useConfirm();

  const { data: currencies } = useQuery(currenciesQuery());
  const { data: addresses, isLoading: addrLoading, error: addrError, refetch: refetchAddr } = useQuery(addressesQuery());
  const { data: recent } = useQuery(ordersQuery({ page: 1, page_size: 3 }));

  /* ── details ── */
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  useEffect(() => {
    if (!user) return;
    setFullName([user.first_name, user.last_name].filter(Boolean).join(" "));
    setPhone(user.phone ?? "");
  }, [user]);

  const saveMe = useMutation({
    mutationFn: authApi.updateMe,
    onSuccess: (u) => {
      setUser(u);
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't update profile"),
  });
  const detailsDirty =
    fullName.trim() !== [user?.first_name, user?.last_name].filter(Boolean).join(" ") || phone.trim() !== (user?.phone ?? "");

  /* ── addresses ── */
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [form, setForm] = useState<AddressInput>(EMPTY_ADDRESS);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const openForm = (a: Address | "new") => {
    setEditing(a);
    setFieldErrors({});
    setForm(
      a === "new"
        ? { ...EMPTY_ADDRESS, full_name: fullName, phone }
        : { label: a.label, full_name: a.full_name, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postal_code: a.postal_code, country_code: a.country_code },
    );
  };

  const refreshAddresses = () => qc.invalidateQueries({ queryKey: accountKeys.addresses });
  const saveAddress = useMutation({
    mutationFn: () =>
      editing && editing !== "new" ? accountApi.updateAddress(editing.id, form) : accountApi.createAddress({ ...form, country_code: form.country_code.toUpperCase() }),
    onSuccess: () => {
      toast.success("Address saved");
      setEditing(null);
      refreshAddresses();
    },
    onError: (e: Error & { fields?: Record<string, string> }) => {
      setFieldErrors(e.fields ?? {});
      toast.error(e.message || "Couldn't save address");
    },
  });
  const makeDefault = useMutation({
    mutationFn: accountApi.setDefaultAddress,
    onSuccess: refreshAddresses,
    onError: (e: Error) => toast.error(e.message),
  });
  const removeAddress = useMutation({
    mutationFn: accountApi.deleteAddress,
    onSuccess: () => {
      toast.success("Address removed");
      refreshAddresses();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't remove address"),
  });

  const onSignOut = async () => {
    const ok = await confirm({ title: "Sign out?", description: "You can sign back in any time with a code sent to your Telegram.", confirmLabel: "Sign out" });
    if (!ok) return;
    await logout();
    qc.clear();
    navigate({ to: "/login", search: { redirect: undefined } });
  };

  if (!user) {
    return <div className="flex h-[60dvh] items-center justify-center"><BrandLoader size="md" /></div>;
  }

  const via = { telegram: "Telegram", otp: "a one-time code", password: "password", admin: "admin" }[user.auth_method as string];
  const field = (k: keyof AddressInput, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <label className="block text-xs font-medium text-muted-foreground">
      {label}
      <Input
        value={form[k]}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        className="mt-1 h-10 text-sm text-foreground"
        aria-invalid={!!fieldErrors[k]}
        {...props}
      />
      {fieldErrors[k] && <span className="mt-1 block text-[11px] text-destructive">{fieldErrors[k]}</span>}
    </label>
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pb-28 pt-4">
      {/* Identity */}
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4">
        <UserAvatar user={user} className="h-14 w-14 text-lg" />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{user.display_name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {user.telegram_identity?.telegram_username ? `@${user.telegram_identity.telegram_username} · ` : ""}
            Member since {formatDate(user.date_joined)}
          </p>
          {(via || user.last_active_at) && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
              {via ? `Signed in with ${via}` : ""}
              {via && user.last_active_at ? " · " : ""}
              {user.last_active_at ? `Active ${formatDate(user.last_active_at)}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Details */}
      <Section title="Account details">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            saveMe.mutate({ full_name: fullName.trim(), phone: phone.trim() });
          }}
        >
          <label className="block text-xs font-medium text-muted-foreground">
            Full name
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 h-10 text-sm text-foreground" autoComplete="name" />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            Phone
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+251911223344" className="mt-1 h-10 text-sm text-foreground" autoComplete="tel" />
          </label>
          {user.email && <p className="text-xs text-muted-foreground">Email: {user.email}</p>}
          <Button type="submit" size="sm" className="rounded-full" disabled={!detailsDirty || saveMe.isPending}>
            {saveMe.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
            Save changes
          </Button>
        </form>
      </Section>

      {/* Preferences */}
      <Section title="Preferences">
        <label className="flex items-center justify-between gap-4 pb-3 text-sm">
          <span>
            <span className="font-medium">Currency</span>
            <span className="block text-xs text-muted-foreground">Prices are shown in this currency</span>
          </span>
          <select
            value={user.preferred_currency?.id ?? ""}
            disabled={!currencies || saveMe.isPending}
            onChange={(e) => saveMe.mutate({ preferred_currency_id: e.target.value })}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            aria-label="Preferred currency"
          >
            {!user.preferred_currency && <option value="">Select…</option>}
            {currencies?.filter((c) => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>{c.code} ({c.symbol})</option>
            ))}
          </select>
        </label>
        <div className="flex items-center justify-between gap-4 border-t border-border py-3 text-sm">
          <span>
            <span className="font-medium">Telegram notifications</span>
            <span className="block text-xs text-muted-foreground">Also manage these on the Notifications page</span>
          </span>
          <Switch checked={user.notify_telegram} onCheckedChange={(v) => saveMe.mutate({ notify_telegram: v })} aria-label="Telegram notifications" />
        </div>
        <div className="border-t border-border pt-1">
          <NotificationPrefsCard />
        </div>
      </Section>

      {/* Addresses */}
      <Section
        title="Saved addresses"
        action={
          editing === null && (
            <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => openForm("new")}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          )
        }
      >
        {editing !== null ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveAddress.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              {field("label", "Label", { placeholder: "Home", required: false })}
              {field("country_code", "Country code", { maxLength: 2, placeholder: "ET", required: true })}
            </div>
            {field("full_name", "Full name", { required: true })}
            {field("phone", "Phone", { required: true, inputMode: "tel" })}
            {field("line1", "Street address", { required: true })}
            {field("line2", "Apartment, suite (optional)")}
            <div className="grid grid-cols-2 gap-3">
              {field("city", "City", { required: true })}
              {field("state", "State / region")}
            </div>
            {field("postal_code", "Postal code")}
            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" className="rounded-full" disabled={saveAddress.isPending}>
                {saveAddress.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Save address
              </Button>
              <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : addrLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : addrError ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Couldn't load addresses. <button className="underline" onClick={() => refetchAddr()}>Retry</button>
          </p>
        ) : !addresses?.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No saved addresses yet.</p>
        ) : (
          <ul className="space-y-2">
            {addresses.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-xl border border-border bg-background p-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">
                    {a.label || "Address"}
                    {a.is_default && <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">Default</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.full_name} · {a.phone}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[a.line1, a.line2, a.city, a.state, a.country_code].filter(Boolean).join(", ")}
                  </p>
                  {!a.is_default && (
                    <button className="mt-1.5 text-xs font-medium text-gold" onClick={() => makeDefault.mutate(a.id)}>
                      Make default
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button aria-label="Edit address" className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted" onClick={() => openForm(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    aria-label="Delete address"
                    className="grid h-8 w-8 place-items-center rounded-full text-destructive hover:bg-destructive/10"
                    disabled={removeAddress.isPending}
                    onClick={async () => {
                      if (await confirm({ title: "Delete this address?", description: "This can't be undone.", confirmLabel: "Delete", danger: true })) removeAddress.mutate(a.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Orders */}
      <Section
        title="Order history"
        action={
          <Link to="/orders" className="flex items-center text-xs font-medium text-gold">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {!recent?.data.length ? (
          <p className="py-4 text-center text-sm text-muted-foreground">You haven't placed any orders yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.data.map((o) => (
              <li key={o.id}>
                <Link to="/orders" search={{ order: o.id }} className="flex items-center gap-3 py-3">
                  <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{ORDER_STATUS_LABEL[o.status]} · {formatDate(o.created_at)}</p>
                  </div>
                  <span className="text-sm font-semibold">{o.currency_symbol} {o.total}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Inside the Telegram Mini App the session follows the Telegram account, so there's nothing to sign out of. */}
      {!isTelegram && (
        <Button variant="outline" className="h-12 rounded-2xl text-destructive" onClick={onSignOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      )}
      {confirmModal}
    </div>
  );
}
