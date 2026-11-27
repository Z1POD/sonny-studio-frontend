import { useRef, useState } from "react";
import { useConfirm } from "@/shared/components/ConfirmModal";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Crown,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Italic,
  Lock,
  Shapes,
  Smile,
  Trash2,
  Type,
  Unlock,
  Upload,
  X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { appToast as toast } from "@/lib/toaster";
import { deleteOwnUpload, uploadArtworkFile } from "../api";
import { DEFAULT_STUDIO_BACKGROUND, layerRestriction, tierAllows } from "../contract";
import { studioArtworkQuery } from "../queries";
import { resolveZoneMethod } from "../lib/zone-method";
import { useArtworkUpload } from "../hooks/useArtworkUpload";
import { dropRecent, loadRecent, newestFirst, pushRecent } from "../lib/recent-artwork";
import { selectSelectedLayer, useStudio } from "../store";
import type { ArtworkItem, Layer, TextLayer } from "../types";

/* ── primitives ──────────────────────────────────────────────────────── */

export function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-foreground">{label}</span>
        {value && <span className="font-mono text-xs tabular-nums text-muted-foreground">{value}</span>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: React.ReactNode; aria: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-[10px] bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          aria-label={o.aria}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-8 flex-1 items-center justify-center rounded-[8px] text-[13px] font-medium transition-all duration-200",
            value === o.value ? "bg-background text-foreground shadow-elevated" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const iconBtn =
  "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent";

/* ── Artwork ─────────────────────────────────────────────────────────── */

export function ArtworkPanel({ header }: { header?: React.ReactNode }) {
  const product0 = useStudio((s) => s.product!);
  const allow = product0.editor.artworkAllowed;
  const tied = allow.tied ? product0.editor.tiedArtwork : [];
  const tabs = ([
    ...(allow.library ? (["artwork", "sticker", "shape"] as const) : []),
    ...(allow.uploads ? (["mine"] as const) : []),
  ]) as ArtworkItem["category"][];
  const [tab0, setTab] = useState<ArtworkItem["category"]>(tabs[0] ?? "artwork");
  const tab: ArtworkItem["category"] = tabs.includes(tab0) ? tab0 : (tabs[0] ?? "artwork");
  const addImage = useStudio((s) => s.addImage);
  const product = useStudio((s) => s.product!);
  const fileRef = useRef<HTMLInputElement>(null);
  const premiumOk = tierAllows(product.userTier, product.editor.premiumArtworkMinTier);
  const { accepted, maxBytes } = { accepted: product.editor.upload.acceptedMimeTypes, maxBytes: product.editor.upload.maxBytes };
  const [confirm, confirmModal] = useConfirm();
  const [recent, setRecent] = useState<ArtworkItem[]>(() => loadRecent());

  const qc = useQueryClient();
  const slug = product.slug;
  const libraryOn = allow.library && tab !== "mine";
  const library = useInfiniteQuery(studioArtworkQuery(tab === "mine" ? "artwork" : tab, slug, libraryOn));
  // The user's own uploads feed the "recent" strip on the Artwork tab and the Mine tab (newest first).
  const mineQuery = useInfiniteQuery(studioArtworkQuery("mine", slug, allow.uploads));
  const mine = newestFirst(mineQuery.data?.pages.flatMap((p) => p.items) ?? []);
  // The server lists the tied rows first; they are already shown in their own section, so drop the repeats.
  const tiedIds = new Set(tied.map((t) => t.id));
  const libraryItems = (library.data?.pages.flatMap((p) => p.items) ?? []).filter((i) => !tiedIds.has(i.id));
  const items = tab === "mine" ? mine : libraryItems;
  // Recently used first, then the rest of the user's uploads, newest → oldest.
  const recentIds = new Set(recent.map((r) => r.id));
  const yours = allow.uploads ? [...recent, ...mine.filter((m) => !recentIds.has(m.id))].slice(0, 12) : [];

  function place(item: ArtworkItem) {
    if (item.assetId) addImage({ name: item.name, src: item.src, category: "upload", assetId: item.assetId });
    else addImage({ name: item.name, src: item.src, category: item.category as "artwork" | "sticker" | "shape", artworkId: item.id });
    setRecent(pushRecent(item));
  }

  async function remove(item: ArtworkItem) {
    const ok = await confirm({
      title: "Delete this upload?",
      description: `"${item.name}" will be removed from your uploads. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok || !item.assetId) return;
    try {
      await deleteOwnUpload(item.assetId);
      setRecent(dropRecent(item.id));
      void qc.invalidateQueries({ queryKey: ["studio", "artwork", "mine"] });
      toast.success("Upload deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete that upload");
    }
  }

  const { upload } = useArtworkUpload();

  const tile = (item: ArtworkItem) => {
    const locked = item.premium && !premiumOk;
    return (
      <button
        key={item.id}
        disabled={locked}
        onClick={() => place(item)}
        className="group relative aspect-square overflow-hidden rounded-[14px] border border-border bg-surface p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elevated disabled:opacity-40"
      >
        <img src={item.src} alt={item.name} crossOrigin="anonymous" loading="lazy" className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105" />
        {item.premium && (
          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-gold-foreground shadow-gold">
            {locked ? <Lock className="h-2.5 w-2.5" /> : <Crown className="h-2.5 w-2.5" />}
          </span>
        )}
        {item.assetId && (
          <span
            role="button"
            aria-label={`Delete ${item.name}`}
            onClick={(e) => {
              e.stopPropagation();
              void remove(item);
            }}
            className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/85 text-muted-foreground opacity-100 shadow-sm transition-opacity hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
          >
            <Trash2 className="h-3 w-3" />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-background/90 to-transparent px-2 pb-1 pt-3 text-[10px] font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {item.name}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {/* Stays pinned to the top of the panel while the grid scrolls. */}
      <div className="sticky top-0 z-10 -mx-5 -mt-2 bg-background/95 px-5 pb-3 pt-2 backdrop-blur">
        {header}
        {tabs.length > 1 && <Segmented
          value={tab}
          onChange={(v) => setTab(v as ArtworkItem["category"])}
          options={[
            { value: "artwork", aria: "Artwork", label: <span className="flex items-center gap-1.5"><ImageIcon className="h-3.5 w-3.5" />Artwork</span> },
            { value: "sticker", aria: "Stickers", label: <span className="flex items-center gap-1.5"><Smile className="h-3.5 w-3.5" />Stickers</span> },
            { value: "shape", aria: "Shapes", label: <span className="flex items-center gap-1.5"><Shapes className="h-3.5 w-3.5" />Shapes</span> },
            { value: "mine", aria: "My uploads", label: <span className="flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" />Mine</span> },
          ].filter((o) => tabs.includes(o.value as ArtworkItem["category"]))}
        />}
      </div>
      {tied.length > 0 && tab !== "mine" && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">For this product</h3>
          <div className="grid grid-cols-3 gap-2.5">{tied.map(tile)}</div>
          {allow.library && <h3 className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Library</h3>}
        </section>
      )}
      {tabs.length === 0 && tied.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">This product only supports text — no artwork can be added.</p>
      )}
      {tab === "artwork" && tied.length === 0 && yours.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your uploads &amp; recent</h3>
          <div className="grid grid-cols-3 gap-2.5">{yours.map(tile)}</div>
          <h3 className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Library</h3>
        </section>
      )}
      {tabs.length === 0 ? null : (tab === "mine" ? mineQuery.isLoading : library.isLoading) ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : library.isError ? (
        <div className="space-y-2 py-4 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load the library.</p>
          <button onClick={() => void library.refetch()} className="rounded-full bg-muted px-4 py-1.5 text-[13px] font-medium text-foreground">Try again</button>
        </div>
      ) : items.length === 0 ? (
        tab !== "mine" && tied.length > 0 ? null : <p className="py-6 text-center text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">{items.map(tile)}</div>
      )}
      {tabs.length > 0 && (tab === "mine" ? mineQuery : library).hasNextPage && (
        <button
          onClick={() => void (tab === "mine" ? mineQuery : library).fetchNextPage()}
          disabled={(tab === "mine" ? mineQuery : library).isFetchingNextPage}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-full bg-muted text-[13px] font-medium text-foreground disabled:opacity-60"
        >
          {(tab === "mine" ? mineQuery : library).isFetchingNextPage && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Load more
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={accepted.join(",")}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void upload(files);
          e.target.value = "";
        }}
      />
      {/* Pinned to the bottom of the panel so it stays reachable however long the list gets. */}
      {allow.uploads && <div className="sticky bottom-0 z-10 -mx-5 -mb-6 bg-background/95 px-5 pb-6 pt-3 backdrop-blur">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-border-strong px-4 py-3 text-left transition-colors hover:bg-muted"
        >
          <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium text-foreground">Upload your artwork</span>
            <span className="block truncate text-[11px] text-muted-foreground">
              Click or drop images here · {accepted.map((m) => m.split("/")[1]!.replace("svg+xml", "svg").replace("jpeg", "jpg").toUpperCase()).join(", ")} · up to {Math.round(maxBytes / 1024 / 1024)} MB
            </span>
          </span>
        </button>
      </div>}
      {confirmModal}
    </div>
  );
}

/* ── Text ────────────────────────────────────────────────────────────── */

export function TextPanel() {
  const selected = useStudio(selectSelectedLayer);
  const addText = useStudio((s) => s.addText);
  const textAllowed = useStudio((s) => s.product?.editor.artworkAllowed.text ?? true);
  const updateLayer = useStudio((s) => s.updateLayer);
  const layer = selected?.kind === "text" ? selected : null;
  const editor = useStudio((s) => s.product!.editor);

  // Policy: no new text on this product.
  if (!layer && !textAllowed) return <p className="py-8 text-center text-sm text-muted-foreground">Text isn't available on this product.</p>;

  if (!layer) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
          <Type className="h-5 w-5 text-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Add a text layer to start styling.</p>
        <button onClick={addText} className="rounded-full bg-primary px-5 py-2 text-[13px] font-semibold text-primary-foreground transition-transform active:scale-95">
          Add text
        </button>
      </div>
    );
  }
  const set = (p: Partial<TextLayer>) => updateLayer(layer.id, p);

  return (
    <div className="space-y-6">
      <textarea
        value={layer.text}
        onChange={(e) => set({ text: e.target.value, name: (e.target.value.split("\n")[0] ?? "").slice(0, 24) || "Text" })}
        rows={2}
        className="w-full resize-none rounded-[12px] border border-border bg-input px-3.5 py-3 text-[15px] text-foreground outline-none transition-shadow focus:ring-2 focus:ring-ring"
        placeholder="Type something"
      />
      <Section title="Font">
        <div className="grid grid-cols-1 gap-1.5">
          {editor.fonts.map((f) => (
            <button
              key={f.id}
              onClick={() => set({ fontFamily: f.family })}
              style={{ fontFamily: f.family }}
              className={cn(
                "flex h-10 items-center justify-between rounded-[10px] px-3 text-[15px] transition-colors",
                layer.fontFamily === f.family ? "bg-primary text-primary-foreground" : "bg-surface text-foreground hover:bg-muted",
              )}
            >
              {f.label}
              <span className="text-xs opacity-60">Aa</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Style">
        <Segmented
          value={String(layer.fontWeight)}
          onChange={(v) => set({ fontWeight: Number(v) })}
          options={[
            { value: "400", aria: "Regular", label: "Regular" },
            { value: "600", aria: "Semibold", label: <span className="font-semibold">Semibold</span> },
            { value: "800", aria: "Heavy", label: <span className="font-extrabold">Heavy</span> },
          ]}
        />
        <div className="flex gap-2">
          <div className="flex-1">
            <Segmented
              value={layer.align}
              onChange={(align) => set({ align })}
              options={[
                { value: "left", aria: "Align left", label: <AlignLeft className="h-4 w-4" /> },
                { value: "center", aria: "Align center", label: <AlignCenter className="h-4 w-4" /> },
                { value: "right", aria: "Align right", label: <AlignRight className="h-4 w-4" /> },
              ]}
            />
          </div>
          <button
            aria-label="Italic"
            onClick={() => set({ italic: !layer.italic })}
            className={cn(
              "flex h-9 w-12 items-center justify-center rounded-[10px] transition-colors",
              layer.italic ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}
          >
            <Italic className="h-4 w-4" />
          </button>
        </div>
        <Field label="Kerning" value={`${layer.letterSpacing > 0 ? "+" : ""}${layer.letterSpacing}`}>
          <Slider min={-10} max={40} step={1} value={[layer.letterSpacing]} onValueChange={([v]) => set({ letterSpacing: v ?? 0 })} />
        </Field>
      </Section>
      <Section title="Color">
        <div className="flex flex-wrap items-center gap-2.5">
          {editor.textColors.map((c) => (
            <button
              key={c}
              aria-label={`Text color ${c}`}
              onClick={() => set({ color: c })}
              style={{ backgroundColor: c }}
              className={cn(
                "h-8 w-8 rounded-full border border-border-strong transition-transform hover:scale-110",
                layer.color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
            />
          ))}
          <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-border-strong bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]">
            <input type="color" value={layer.color} onChange={(e) => set({ color: e.target.value })} className="absolute inset-0 opacity-0" aria-label="Custom text color" />
          </label>
        </div>
      </Section>
    </div>
  );
}

/* ── Color + print method ───────────────────────────────────────────── */

export function ColorPanel({ compact = false }: { compact?: boolean }) {
  const product = useStudio((s) => s.product!);
  const colorId = useStudio((s) => s.colorId);
  const setColor = useStudio((s) => s.setColor);
  const current = product.colors.find((c) => c.id === colorId);

  return (
    <div className="space-y-6">
      <Section title="Garment color" action={<span className="text-[13px] text-foreground">{current?.name}</span>}>
        <div className={cn("flex flex-wrap gap-3", compact && "justify-center")}>
          {product.colors.map((c) => (
            <button
              key={c.id}
              disabled={!c.inStock}
              aria-label={c.name}
              title={c.inStock ? c.name : `${c.name} — sold out`}
              onClick={() => setColor(c.id)}
              style={{ backgroundColor: c.hex }}
              className={cn(
                "relative h-10 w-10 rounded-full border border-border-strong shadow-elevated transition-all duration-200 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100",
                colorId === c.id && "ring-2 ring-foreground ring-offset-[3px] ring-offset-background",
              )}
            >
              {!c.inStock && <span className="absolute left-1/2 top-1/2 h-px w-12 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-foreground/70" />}
            </button>
          ))}
        </div>
      </Section>
      <BackgroundSection />
      <VisibilitySection />
    </div>
  );
}

/** Listing visibility: private products are unlisted after approval and only reachable through their share link. */
function VisibilitySection() {
  const isPrivate = useStudio((s) => s.isPrivate);
  const setPrivate = useStudio((s) => s.setPrivate);
  return (
    <Section title="Visibility">
      <div className="flex items-center justify-between gap-3 rounded-[14px] border border-border p-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground">Private (share link only)</p>
          <p className="text-[11px] text-muted-foreground">Not shown in the market or search. Anyone with your link can view and order it. Changing this later means copying the design.</p>
        </div>
        <Switch checked={isPrivate} onCheckedChange={setPrivate} />
      </div>
    </Section>
  );
}

function BackgroundSection() {
  const bg = useStudio((s) => s.bgColor);
  const setBg = useStudio((s) => s.setBgColor);
  const defaultBg = useStudio((s) => s.product!.background) ?? DEFAULT_STUDIO_BACKGROUND;
  const swatches = useStudio((s) => s.product!.editor.backgroundSwatches);
  const current = bg ?? defaultBg;
  return (
    <Section
      title="Canvas background"
      action={
        current !== defaultBg ? (
          <button onClick={() => setBg(defaultBg)} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Reset
          </button>
        ) : (
          <span className="text-[12px] text-muted-foreground">Default</span>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          aria-label="Default background"
          onClick={() => setBg(defaultBg)}
          style={{ backgroundColor: defaultBg }}
          className={cn(
            "h-8 w-8 rounded-full border border-border-strong transition-transform hover:scale-110",
            current === defaultBg && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
          )}
        />
        {swatches.filter((c) => c.toLowerCase() !== defaultBg.toLowerCase()).map((c) => (
          <button
            key={c}
            aria-label={`Background ${c}`}
            onClick={() => setBg(c)}
            style={{ backgroundColor: c }}
            className={cn(
              "h-8 w-8 rounded-full border border-border-strong transition-transform hover:scale-110",
              current === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
            )}
          />
        ))}
        <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border border-border-strong bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(current) ? current : "#e4e7ec"} onChange={(e) => setBg(e.target.value)} className="absolute inset-0 opacity-0" aria-label="Custom background color" />
        </label>
      </div>
    </Section>
  );
}

/* ── Zones ───────────────────────────────────────────────────────────── */

export function ZonesPanel() {
  const product = useStudio((s) => s.product!);
  const active = useStudio((s) => s.activeZone);
  const setZone = useStudio((s) => s.setZone);
  const layers = useStudio((s) => s.layers);
  const zoneMethods = useStudio((s) => s.zoneMethods);
  const fallback = useStudio((s) => s.printMethod);
  const setZoneMethod = useStudio((s) => s.setZoneMethod);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const sym = product.currencySymbol;

  return (
    <div className="space-y-2">
      {product.printZones.map((z) => {
        const count = layers.filter((l) => l.zoneId === z.id).length;
        const currentId = resolveZoneMethod(z, zoneMethods, fallback);
        const current = product.printMethods.find((m) => m.id === currentId);
        const expanded = !!open[z.id];
        const options = product.printMethods.filter((m) => z.allowedMethods.includes(m.id));
        return (
          <div
            key={z.id}
            className={cn("rounded-[14px] border transition-all", active === z.id ? "border-foreground bg-surface" : "border-border hover:border-border-strong")}
          >
            <div className="flex items-center gap-1 pr-2">
              <button onClick={() => setZone(z.id)} className="flex min-w-0 flex-1 items-center gap-3.5 p-3 text-left">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-muted">
                  <span
                    className="rounded-[2px] border-[1.5px] border-dashed border-foreground/60"
                    style={{ width: `${Math.min(36, Math.max(10, z.size[0] * 90))}px`, height: `${Math.min(36, Math.max(10, z.size[1] * 90))}px` }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-foreground">{z.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {z.printAreaCm[0]} × {z.printAreaCm[1]} cm · {current?.label ?? "No method"}
                  </span>
                </span>
                {count > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary-foreground">{count}</span>
                )}
              </button>
              {options.length > 1 && (
                <button
                  aria-label={expanded ? `Hide print methods for ${z.label}` : `Show print methods for ${z.label}`}
                  aria-expanded={expanded}
                  onClick={() => setOpen((o) => ({ ...o, [z.id]: !o[z.id] }))}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} />
                </button>
              )}
            </div>
            {expanded && (
              <div className="space-y-1.5 border-t border-border px-3 pb-3 pt-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Print method</p>
                {options.map((m) => {
                  const tierOk = tierAllows(product.userTier, m.minTier);
                  const selected = currentId === m.id;
                  return (
                    <button
                      key={m.id}
                      disabled={!tierOk}
                      onClick={() => setZoneMethod(z.id, m.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-[12px] border p-2.5 text-left transition-all",
                        selected ? "border-foreground bg-background" : "border-border hover:border-border-strong",
                        !tierOk && "cursor-not-allowed opacity-45",
                      )}
                    >
                      <span className={cn("mt-0.5 h-4 w-4 shrink-0 rounded-full border-2", selected ? "border-[5px] border-foreground" : "border-border-strong")} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium text-foreground">{m.label}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">{m.priceDelta ? `+${sym}${m.priceDelta}` : "Included"}</span>
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {!tierOk ? (
                            <span className="inline-flex items-center gap-1 text-gold"><Lock className="h-3 w-3" />Requires {m.minTier} plan</span>
                          ) : (
                            m.description
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Layers + transform ─────────────────────────────────────────────── */

function LayerThumb({ layer }: { layer: Layer }) {
  if (layer.kind === "text")
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-muted">
        <Type className="h-4 w-4 text-foreground" />
      </span>
    );
  return <img src={layer.src} alt="" className="h-9 w-9 rounded-[8px] bg-muted object-contain p-1" />;
}

export function LayersPanel() {
  const product = useStudio((s) => s.product!);
  const layers = useStudio((s) => s.layers);
  const selectedId = useStudio((s) => s.selectedId);
  const { select, updateLayer, removeLayer, duplicateLayer, moveLayer } = useStudio.getState();
  const ordered = [...layers].reverse();
  const zoneLabel = (id: string) => product.printZones.find((z) => z.id === id)?.label;

  return (
    <div className="space-y-6">
      {ordered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No layers yet. Add artwork or text.</p>
      ) : (
        <ul className="space-y-1">
          {ordered.map((l) => {
            const idx = layers.indexOf(l);
            const restriction = layerRestriction(product, l);
            return (
              <li
                key={l.id}
                onClick={() => select(l.id)}
                className={cn(
                  "group flex cursor-pointer items-center gap-2.5 rounded-[12px] p-1.5 pr-1 transition-colors",
                  selectedId === l.id ? "bg-muted" : "hover:bg-surface",
                  !l.visible && "opacity-50",
                )}
              >
                <LayerThumb layer={l} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">{l.name}</span>
                  {restriction ? (
                    <span className="block text-[11px] font-medium text-destructive">No longer available on this product</span>
                  ) : (
                    <span className="block text-[11px] text-muted-foreground">{zoneLabel(l.zoneId)}</span>
                  )}
                </span>
                {restriction && (
                  <button
                    type="button"
                    title={restriction}
                    onClick={(e) => { e.stopPropagation(); removeLayer(l.id); }}
                    className="mr-1 shrink-0 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive"
                  >
                    Remove
                  </button>
                )}
                <span className="flex items-center" onClick={(e) => e.stopPropagation()}>
                  <button aria-label="Bring forward" className={iconBtn} disabled={idx === layers.length - 1} onClick={() => moveLayer(l.id, "up")}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button aria-label="Send backward" className={iconBtn} disabled={idx === 0} onClick={() => moveLayer(l.id, "down")}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button aria-label={l.visible ? "Hide layer" : "Show layer"} className={iconBtn} onClick={() => updateLayer(l.id, { visible: !l.visible })}>
                    {l.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <button aria-label={l.locked ? "Unlock layer" : "Lock layer"} className={iconBtn} onClick={() => updateLayer(l.id, { locked: !l.locked })}>
                    {l.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <TransformSection onDuplicate={duplicateLayer} onRemove={removeLayer} />
    </div>
  );
}

export function TransformSection({ onDuplicate, onRemove }: { onDuplicate: (id: string) => void; onRemove: (id: string) => void }) {
  const layer = useStudio(selectSelectedLayer);
  const updateTransform = useStudio((s) => s.updateTransform);
  if (!layer) return null;
  const t = layer.transform;
  const set = (p: Partial<Layer["transform"]>) => updateTransform(layer.id, p);
  const disabled = layer.locked;

  return (
    <Section
      title="Adjust"
      action={
        <span className="flex">
          <button aria-label="Duplicate layer" className={iconBtn} onClick={() => onDuplicate(layer.id)}>
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button aria-label="Delete layer" className={cn(iconBtn, "hover:text-destructive")} onClick={() => onRemove(layer.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      }
    >
      <div className={cn("space-y-4", disabled && "pointer-events-none opacity-40")}>
        <Field label="Size" value={`${Math.round(t.scale * 100)}%`}>
          <Slider min={0.08} max={1} step={0.01} value={[t.scale]} onValueChange={([v]) => set({ scale: v ?? 0 })} />
        </Field>
        <Field label="Rotation" value={`${Math.round(t.rotation)}°`}>
          <Slider min={-180} max={180} step={1} value={[t.rotation]} onValueChange={([v]) => set({ rotation: v ?? 0 })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Horizontal" value={t.x.toFixed(2)}>
            <Slider min={-1} max={1} step={0.01} value={[t.x]} onValueChange={([v]) => set({ x: v ?? 0 })} />
          </Field>
          <Field label="Vertical" value={t.y.toFixed(2)}>
            <Slider min={-1} max={1} step={0.01} value={[t.y]} onValueChange={([v]) => set({ y: v ?? 0 })} />
          </Field>
        </div>
        <Field label="Opacity" value={`${Math.round(t.opacity * 100)}%`}>
          <Slider min={0.1} max={1} step={0.01} value={[t.opacity]} onValueChange={([v]) => set({ opacity: v ?? 0 })} />
        </Field>
      </div>
      {disabled && <p className="text-xs text-muted-foreground">Layer is locked. Unlock it to edit.</p>}
    </Section>
  );
}
