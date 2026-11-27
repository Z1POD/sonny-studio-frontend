// Edit the store profile: PATCH /store/ (only changed keys are sent). Logo → purpose product_thumbnail,
// banner → store_banner; upload first, then pass the asset id.

"use client";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ImagePlus, Loader2, X } from "lucide-react";
import { appToast as toast } from "@/lib/toaster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { uploadAsset } from "@/shared/api/assets";
import { ApiError } from "@/shared/api/client";
import { storeApi, type StoreSocialLinks, type UpdateStoreProfilePayload } from "../storeApi";
import { storeKeys, storeProfileQuery } from "../queries";

const SOCIALS: { key: keyof StoreSocialLinks; label: string; placeholder: string }[] = [
  { key: "instagram_url", label: "Instagram", placeholder: "https://instagram.com/yourstore" },
  { key: "tiktok_url", label: "TikTok", placeholder: "https://tiktok.com/@yourstore" },
  { key: "telegram_url", label: "Telegram", placeholder: "https://t.me/yourstore" },
  { key: "website_url", label: "Website", placeholder: "https://" },
];

function ImagePick({ label, url, onPick, onRemove, tall }: { label: string; url: string | null; onPick: (f: File) => void; onRemove?: () => void; tall?: boolean }) {
  return (
    <div className={`relative ${tall ? "w-full" : "shrink-0"}`}>
    <label className={`group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface-elevated/40 ${tall ? "h-28 w-full" : "h-20 w-20 shrink-0"}`}>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
      <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">{label}</span>
      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
    </label>
    {url && onRemove && (
      <button
        type="button"
        aria-label={`Remove ${tall ? "banner" : "logo"}`}
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/65 text-white shadow transition hover:bg-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
    </div>
  );
}

export function StoreProfileSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { data: profile } = useQuery({ ...storeProfileQuery(), enabled: open });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [links, setLinks] = useState<StoreSocialLinks>({});
  const [accepting, setAccepting] = useState(true);
  const [logo, setLogo] = useState<{ id: string; url: string } | null>(null);
  const [banner, setBanner] = useState<{ id: string; url: string } | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [removeBanner, setRemoveBanner] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "banner" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile || !open) return;
    setName(profile.name ?? "");
    setDescription(profile.description ?? "");
    setPhone(profile.contact_phone ?? "");
    setLinks(profile.social_links ?? {});
    setAccepting(profile.is_accepting_orders);
    setLogo(null);
    setBanner(null);
    setRemoveLogo(false);
    setRemoveBanner(false);
    setErrors({});
  }, [profile, open]);

  const upload = async (kind: "logo" | "banner", file: File) => {
    setUploading(kind);
    try {
      const a = await uploadAsset(file, kind === "logo" ? "product_thumbnail" : "store_banner");
      const v = { id: a.id, url: a.secure_url };
      if (kind === "logo") { setLogo(v); setRemoveLogo(false); } else { setBanner(v); setRemoveBanner(false); }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const save = useMutation({
    mutationFn: () => {
      const payload: UpdateStoreProfilePayload = {
        name: name.trim(),
        description,
        contact_phone: phone.trim(),
        social_links: Object.fromEntries(SOCIALS.map((s) => [s.key, (links[s.key] ?? "").trim()])),
        is_accepting_orders: accepting,
        ...(logo ? { logo_asset_id: logo.id } : removeLogo ? { logo_asset_id: null } : {}),
        ...(banner ? { banner_asset_id: banner.id } : removeBanner ? { banner_asset_id: null } : {}),
      };
      return storeApi.updateProfile(payload);
    },
    onSuccess: (p) => {
      toast.success("Store updated");
      qc.setQueryData(storeKeys.profile, p);
      qc.invalidateQueries({ queryKey: storeKeys.dashboard });
      onOpenChange(false);
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.fields) {
        // Field errors arrive as { "social_links.instagram_url": "…", name: "…" }.
        setErrors(e.fields);
        toast.error(e.message);
      } else toast.error(e instanceof Error ? e.message : "Couldn't save your store");
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-hidden rounded-t-3xl border border-border/60 bg-surface p-0 md:inset-x-auto md:left-1/2 md:w-[560px] md:-translate-x-1/2 md:rounded-3xl">
        <SheetHeader className="border-b border-border/40 px-5 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            Store profile
            {profile?.is_verified && <BadgeCheck className="h-4 w-4 text-primary" aria-label="Verified" />}
          </SheetTitle>
          <SheetDescription className="text-xs">How your storefront looks to buyers.</SheetDescription>
        </SheetHeader>

        <div className="max-h-[calc(92dvh-150px)] space-y-5 overflow-y-auto px-5 py-5 no-scrollbar">
          <ImagePick label={uploading === "banner" ? "Uploading…" : "Change banner"} url={banner?.url ?? (removeBanner ? null : profile?.banner_url ?? null)} onPick={(f) => upload("banner", f)} onRemove={() => { setBanner(null); setRemoveBanner(true); }} tall />
          <div className="flex items-center gap-4">
            <ImagePick label={uploading === "logo" ? "Uploading…" : "Logo"} url={logo?.url ?? (removeLogo ? null : profile?.logo_url ?? null)} onPick={(f) => upload("logo", f)} onRemove={() => { setLogo(null); setRemoveLogo(true); }} />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="s-name">Store name</Label>
              <Input id="s-name" value={name} maxLength={150} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-desc">About</Label>
            <Textarea id="s-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell buyers what your store is about" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="s-phone">Contact phone</Label>
            <Input id="s-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251 9…" aria-invalid={!!errors.contact_phone} />
            {errors.contact_phone && <p className="text-xs text-destructive">{errors.contact_phone}</p>}
          </div>

          <div className="space-y-3">
            <Label>Links</Label>
            {SOCIALS.map((s) => {
              const err = errors[`social_links.${s.key}`];
              return (
                <div key={s.key} className="space-y-1">
                  <Input aria-label={s.label} inputMode="url" value={links[s.key] ?? ""} onChange={(e) => setLinks((l) => ({ ...l, [s.key]: e.target.value }))} placeholder={`${s.label} — ${s.placeholder}`} aria-invalid={!!err} />
                  {err && <p className="text-xs text-destructive">{err}</p>}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-surface-elevated/40 p-4">
            <div>
              <p className="text-sm font-medium">Accepting orders</p>
              <p className="text-xs text-muted-foreground">Turn off to pause checkout. Your storefront stays browsable.</p>
            </div>
            <Switch checked={accepting} onCheckedChange={setAccepting} />
          </div>
        </div>

        <div className="flex gap-2 border-t border-border/40 px-5 py-4">
          <Button variant="outline" className="flex-1 rounded-full" onClick={() => onOpenChange(false)} disabled={save.isPending}>Cancel</Button>
          <Button className="flex-1 rounded-full" onClick={() => { setErrors({}); save.mutate(); }} disabled={save.isPending || !!uploading || !name.trim()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
