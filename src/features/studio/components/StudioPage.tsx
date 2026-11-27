import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronUp,
  Layers as LayersIcon,
  Loader2,
  Moon,
  Palette,
  Sparkles,
  Sun,
  Type,
  X,
  Check,
  Move,
  RotateCcw,
  Shirt,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { appToast as toast } from "@/lib/toaster";
import { ApiError } from "@/shared/api/client";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useTheme } from "@/shared/stores/theme-store";
import { useConfirm } from "@/shared/components/ConfirmModal";
import { useArtworkUpload } from "../hooks/useArtworkUpload";
import { studioApi, uploadMockups } from "../api";
import { DEFAULT_STUDIO_BACKGROUND, buildSaveDesignBody, estimatePrice, validateForSave } from "../contract";
import { captureMockups } from "../lib/capture";
import { planMockupShots } from "../lib/capture-plan";
import { resolveAllZoneMethods } from "../lib/zone-method";
import { studioConfigQuery } from "../queries";
import { useStudio } from "../store";
import type { MockupCapture, PanelId, SaveDesignResult } from "../types";
import { ArtworkPanel, ColorPanel, LayersPanel, TextPanel, ZonesPanel } from "./panels";
import { StudioCanvas } from "./StudioCanvas";
import { StudioOverlay, type OverlayStep } from "./StudioOverlay";
import { AdjustSheet } from "./AdjustSheet";

const SAVE_STEPS: { id: NonNullable<ReturnType<typeof useStudio.getState>["saveStep"]>; label: string }[] = [
  { id: "validate", label: "Checking your design" },
  { id: "capture", label: "Capturing mockups" },
  { id: "upload", label: "Uploading mockups" },
  { id: "save", label: "Saving design" },
];

type SheetPanel = Exclude<PanelId, null | "adjust">;

const TOOLS: { id: Exclude<PanelId, null>; label: string; icon: typeof Type }[] = [
  { id: "adjust", label: "Adjust", icon: Move },
  { id: "artwork", label: "Add", icon: Sparkles },
  { id: "color", label: "Color", icon: Palette },
  { id: "layers", label: "Layers", icon: LayersIcon },
  { id: "zones", label: "Zones", icon: Shirt },
];

/** Merged tools: one rail button covers related panels. */
const TOOL_GROUP: Record<Exclude<PanelId, null>, Exclude<PanelId, null>> = {
  adjust: "adjust", artwork: "artwork", text: "artwork", color: "color", layers: "layers", zones: "zones",
};

function AddSwitch({ panel }: { panel: "artwork" | "text" }) {
  const setPanel = useStudio((s) => s.setPanel);
  const allow = useStudio((s) => s.product?.editor.artworkAllowed);
  const hasArtwork = !allow || allow.tied || allow.library || allow.uploads;
  const hasText = !allow || allow.text;
  const options = ([["artwork", "Artwork", Sparkles], ["text", "Text", Type]] as const).filter(([id]) => (id === "artwork" ? hasArtwork : hasText));
  if (options.length < 2) return null; // a single source needs no switch
  return (
    <div className="mb-4 flex rounded-full bg-muted p-0.5">
      {options.map(([id, label, Icon]) => (
        <button key={id} onClick={() => setPanel(id)} aria-pressed={panel === id}
          className={cn("flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full text-[12px] font-medium transition-all",
            panel === id ? "bg-background text-foreground shadow-elevated" : "text-muted-foreground")}>
          <Icon className="h-3.5 w-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}

const PANEL_TITLES: Record<SheetPanel, string> = {
  artwork: "Add design",
  text: "Add design",
  color: "Color & print",
  zones: "Print areas",
  layers: "Layers",
};

function PanelBody({ panel }: { panel: SheetPanel }) {
  switch (panel) {
    case "artwork":
      return <ArtworkPanel header={<AddSwitch panel="artwork" />} />;
    case "text":
      return <><AddSwitch panel="text" /><TextPanel /></>;
    case "color":
      return <ColorPanel />;
    case "layers":
      return <LayersPanel />;
    case "zones":
      return <ZonesPanel />;
  }
}

function ThemeToggle() {
  const theme = useTheme((s) => s.mode);
  const toggle = useTheme((s) => s.toggle);
  return (
    <button
      aria-label="Toggle theme"
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
    >
      {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

function ModeSwitch() {
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  return (
    <div className="relative flex h-9 rounded-full bg-muted p-0.5" role="tablist">
      <span
        className={cn(
          "absolute top-0.5 h-8 w-[76px] rounded-full bg-background shadow-elevated transition-transform duration-300 ease-[var(--ease-spring)]",
          mode === "preview" && "translate-x-[76px]",
        )}
      />
      {(["edit", "preview"] as const).map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          onClick={() => setMode(m)}
          className={cn(
            "relative z-10 w-[76px] text-[13px] font-medium capitalize transition-colors",
            mode === m ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function ContinueButton({ onSave }: { onSave: () => void }) {
  const saving = useStudio((s) => s.saving);
  return (
    <button
      onClick={onSave}
      disabled={saving}
      className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
    >
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {saving ? "Saving" : "Continue"}
    </button>
  );
}

/** Top of the studio: [back + edit/preview] centred; the product title, theme and Continue flank it on larger screens. */
function TopBar({ onSave, onBack }: { onSave: () => void; onBack: () => void }) {
  const product = useStudio((s) => s.product!);
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-20 grid grid-cols-[1fr_auto_1fr] items-start gap-3 p-3 pt-5 safe-top sm:p-5 sm:pt-7">
      <div className="glass pointer-events-auto hidden h-12 items-center justify-self-start rounded-full border border-border px-5 shadow-glass md:flex">
        <p className="text-[14px] font-semibold tracking-tight text-foreground">{product.name}</p>
      </div>
      <div className="glass pointer-events-auto col-start-2 flex h-12 items-center gap-1 rounded-full border border-border pl-1.5 pr-1.5 shadow-glass">
        <button aria-label="Back" onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <ModeSwitch />
      </div>
      <div className="glass pointer-events-auto col-start-3 hidden h-12 items-center gap-1 justify-self-end rounded-full border border-border p-1.5 shadow-glass md:flex">
        <ThemeToggle />
        <ContinueButton onSave={onSave} />
      </div>
    </header>
  );
}

/** Phones only: title in one corner, theme + Continue in the other, sitting on top of the tool tabs. */
function DockHeader({ onSave }: { onSave: () => void }) {
  const product = useStudio((s) => s.product!);
  return (
    <div className="flex items-center justify-between gap-3 px-1.5 pb-1.5 pt-0.5">
      <p className="min-w-0 truncate pl-1 text-[13px] font-semibold tracking-tight text-foreground">{product.name}</p>
      <div className="flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <ContinueButton onSave={onSave} />
      </div>
    </div>
  );
}

function ToolRail({ flat = false }: { flat?: boolean }) {
  const panel = useStudio((s) => s.panel);
  const setPanel = useStudio((s) => s.setPanel);
  const current = panel ? TOOL_GROUP[panel] : null;
  return (
    <nav className={cn("pointer-events-auto flex gap-1 md:flex-col", flat ? "justify-between" : "glass rounded-[22px] border border-border p-1.5 shadow-glass")}>
      {TOOLS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setPanel(current === id ? null : id)}
          aria-pressed={current === id}
          className={cn(
            "group flex h-14 flex-col items-center justify-center gap-1 rounded-[16px] transition-all duration-200 md:h-[60px] md:w-[60px]",
            flat ? "flex-1" : "w-14",
            current === id ? "bg-primary text-primary-foreground shadow-elevated" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
          <span className="text-[10px] font-medium leading-none">{label.split(" ")[0]}</span>
        </button>
      ))}
    </nav>
  );
}

function DesktopPanel() {
  const panel = useStudio((s) => s.panel);
  const setPanel = useStudio((s) => s.setPanel);
  if (!panel || panel === "adjust") return null;
  return (
    <aside
      key={panel}
      className="glass-strong animate-studio-rise pointer-events-auto absolute bottom-5 right-5 z-20 flex max-h-[calc(100dvh-110px)] w-[340px] flex-col overflow-hidden rounded-[28px] border border-border shadow-glass"
    >
      <div className="flex items-center justify-between px-5 pb-2 pt-5">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">{PANEL_TITLES[panel]}</h2>
        <button aria-label="Close panel" onClick={() => setPanel(null)} className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-6 pt-2">
        <PanelBody panel={panel} />
      </div>
    </aside>
  );
}

function MobilePanel() {
  const panel = useStudio((s) => s.panel);
  const setPanel = useStudio((s) => s.setPanel);
  return (
    <Drawer open={!!panel && panel !== "adjust"} onOpenChange={(o) => !o && setPanel(null)} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[50vh] border-border bg-background">
        {panel && panel !== "adjust" && (
          <>
            <div className="flex items-center justify-between px-5 pb-1 pt-3">
              <DrawerTitle className="text-[17px] font-semibold tracking-tight">{PANEL_TITLES[panel]}</DrawerTitle>
            </div>
            <div className="no-scrollbar overflow-y-auto px-5 pb-8 pt-3 safe-bottom">
              <PanelBody panel={panel} />
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function AutoRotateToggle() {
  const on = useStudio((s) => s.autoRotate);
  const set = useStudio((s) => s.setAutoRotate);
  return (
    <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 border-t border-border pt-3">
      <span className="text-[13px] font-medium text-foreground">Auto rotate</span>
      <Switch checked={on} onCheckedChange={set} aria-label="Auto rotate" />
    </label>
  );
}

function PreviewDock() {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-strong animate-studio-rise pointer-events-auto w-full max-w-md rounded-[28px] border border-border shadow-glass">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Hide colors" : "Show colors"}
        className="flex h-12 w-full items-center justify-between gap-3 px-5"
      >
        <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          <Palette className="h-4 w-4" /> Color &amp; background
        </span>
        <ChevronUp className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-5 pb-4">
          <ColorPanel compact />
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <RotateCcw className="h-3 w-3" /> Drag to orbit · pinch or scroll to zoom
          </p>
        </div>
      )}
      <div className="px-5 pb-3">
        <AutoRotateToggle />
      </div>
    </div>
  );
}

function SaveDialog({
  open,
  onOpenChange,
  captures,
  result,
  onReview,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  captures: MockupCapture[];
  result: SaveDesignResult | null;
  onReview: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[50dvh] max-w-2xl overflow-y-auto rounded-[28px] border-border bg-background p-0 sm:rounded-[28px] md:max-h-[calc(100dvh-40px)]">
        <div className="p-6 pb-3">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-success text-primary-foreground">
            <Check className="h-5 w-5" />
          </div>
          <DialogTitle className="text-[22px] font-semibold tracking-tight">Draft saved</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {captures.length} mockups captured
            {result && (
              <>
                {" "}
                · {result.currencySymbol}
                {result.pricing.unitPrice.toFixed(2)} cost per item
              </>
            )}
          </p>
        </div>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-6 pb-2">
          {captures.map((c) => (
            <figure key={c.angle} className="shrink-0">
              <img src={c.dataUrl} alt={`${c.angle} mockup`} className="studio-stage h-40 w-32 rounded-[16px] border border-border object-cover" />
              <figcaption className="mt-1.5 text-center text-[11px] font-medium capitalize text-muted-foreground">{c.angle}</figcaption>
            </figure>
          ))}
        </div>
        <div className="flex gap-2 p-6 pt-4">
          <button onClick={() => onOpenChange(false)} className="h-11 flex-1 rounded-full bg-muted text-[14px] font-medium text-foreground">
            Keep editing
          </button>
          <button onClick={onReview} className="h-11 flex-1 rounded-full bg-primary text-[14px] font-semibold text-primary-foreground">
            Review &amp; publish
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">{children}</div>;
}

/**
 * `/studio?blank=<slug>[&design=<design id>][&color=<hex>][&view=3d]`
 *  - blank:  the blank product to open (config comes from `GET /studio/products/{slug}/config/`)
 *  - from: a published listing of yours → an editable copy; a plain save creates a new draft (published designs are frozen)
 *  - design: one of the creator's own saved designs → the config carries its layers + colour + `editing_design_id`, so a save is an update
 *  - view=3d: open straight in preview (orbit) mode
 *  - color: preferred garment colour (hex), applied when the product offers it
 */
export function StudioPage() {
  const { blank, design, from, color, view } = useSearch({ strict: false }) as { blank?: string; design?: string; from?: string; color?: string; view?: "3d" };
  const router = useRouter();
  const navigate = useNavigate();
  const { enableClosingConfirmation, disableClosingConfirmation } = useTelegram();

  const product = useStudio((s) => s.product);
  const mode = useStudio((s) => s.mode);
  const load = useStudio((s) => s.load);
  const panel = useStudio((s) => s.panel);
  const bgColor = useStudio((s) => s.bgColor);
  const saveStep = useStudio((s) => s.saveStep);
  const modelLoading = useStudio((s) => s.modelLoading);
  const canvasError = useStudio((s) => s.canvasError);
  const saveIndex = SAVE_STEPS.findIndex((st) => st.id === saveStep);
  const isMobile = useIsMobile();
  const [captures, setCaptures] = useState<MockupCapture[]>([]);
  const [result, setResult] = useState<SaveDesignResult | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const loadedFor = useRef<unknown>(null);

  const config = useQuery({ ...studioConfigQuery(blank ?? "", from, design), enabled: !!blank });

  useEffect(() => {
    enableClosingConfirmation();
    return () => disableClosingConfirmation();
  }, [enableClosingConfirmation, disableClosingConfirmation]);

  useEffect(() => {
    if (!config.data || loadedFor.current === config.data) return;
    loadedFor.current = config.data;
    const preferred = color ? config.data.colors.find((c) => c.hex.toLowerCase() === color.toLowerCase()) : undefined;
    load(config.data, { colorId: preferred?.id });
    if (view === "3d") useStudio.getState().setMode("preview");
  }, [config.data, color, view, load]);

  // Leaving the studio drops the session's design so the next product starts clean.
  useEffect(
    () => () => {
      loadedFor.current = null;
      useStudio.setState({ product: null, designId: null, panel: null });
    },
    [],
  );

  const [confirm, confirmModal] = useConfirm();
  const { upload } = useArtworkUpload();
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const goBack = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: "/designs" });
  };

  /** Back button / Telegram back: leaving drops everything that isn't saved, so ask first. */
  const requestBack = async () => {
    if (useStudio.getState().saving) return;
    const ok = await confirm({
      title: "Leave the studio?",
      description: "Leaving will discard your unsaved changes. This cannot be undone.",
      confirmLabel: "Discard & leave",
      danger: true,
    });
    if (ok) goBack();
  };
  const requestBackRef = useRef(requestBack);
  requestBackRef.current = requestBack;
  useEffect(() => {
    const h = () => void requestBackRef.current();
    window.addEventListener("studio:request-back", h);
    return () => window.removeEventListener("studio:request-back", h);
  }, []);

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (useStudio.getState().saving || useStudio.getState().mode !== "edit") return;
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) toast.error("Drop an image file (PNG, JPG, SVG or WebP)");
      else void upload(files);
    },
  };

  async function handleSave() {
    const s = useStudio.getState();
    if (!s.product || s.saving) return;
    s.setSaving(true);
    s.setSaveStep("validate");
    try {
      const problem = validateForSave({ product: s.product, layers: s.layers, printMethodId: s.printMethod, zoneMethods: resolveAllZoneMethods(s.product, s.zoneMethods, s.printMethod) });
      if (problem) {
        toast.error(problem);
        return;
      }
      // Hide the selection frame so it never ends up in a mockup.
      s.select(null);
      s.setSaveStep("capture");
      await new Promise((r) => setTimeout(r, 60));
      const shots = await captureMockups(planMockupShots(s.product, s.layers));
      if (shots.length === 0) throw new Error("Couldn't capture the preview");
      s.setSaveStep("upload");
      const uploaded = await uploadMockups(shots);
      s.setSaveStep("save");
      const printed = new Set(s.layers.filter((l) => l.visible).map((l) => l.zoneId)).size;
      const delta = s.product.printMethods.find((m) => m.id === s.printMethod)?.priceDelta ?? 0;
      const body = buildSaveDesignBody({
        product: s.product,
        colorId: s.colorId,
        printMethodId: s.printMethod,
        zoneMethods: resolveAllZoneMethods(s.product, s.zoneMethods, s.printMethod),
        layers: s.layers,
        bgColor: useStudio.getState().bgColor,
        mockups: uploaded,
        derivedFrom: null,
        estimate: estimatePrice(s.product, delta, printed),
        app: "creator-studio",
        purpose: "listing",
        isPrivate: s.isPrivate,
        isUpdate: !!s.designId,
      });
      const res = await studioApi.saveDesign(body, s.designId);
      s.setDesignId(res.designId);
      setCaptures(shots);
      setResult(res);
      setSavedOpen(true);
    } catch (e) {
      // Frozen design (under review / published / archived): offer the copy flow instead of a dead end.
      if (e instanceof ApiError && e.fields?.design) {
        toast.error(e.fields.design, {
          duration: 12000,
          action: { label: "Save as new copy", onClick: () => { useStudio.getState().setDesignId(null); void handleSave(); } },
        });
        return;
      }
      // Artwork-policy rejections arrive as a field map (print_zones[i].layers[j]…): show each distinct message.
      const policy = e instanceof ApiError && e.fields ? [...new Set(Object.values(e.fields))].join(" ") : "";
      toast.error(policy || (e instanceof ApiError || e instanceof Error ? e.message : "Couldn't save design"));
    } finally {
      useStudio.getState().setSaving(false);
      useStudio.getState().setSaveStep(null);
    }
  }

  /** Hand off to Publish & Review: the Designs screen opens the review modal for the draft just saved. */
  function handleReview() {
    if (!result) return;
    setSavedOpen(false);
    void navigate({ to: "/designs", search: { review: result.designId } });
  }

  return (
    <main
      className="fixed inset-0 overflow-hidden font-ui transition-[background] duration-500"
      style={{ background: bgColor ?? product?.background ?? DEFAULT_STUDIO_BACKGROUND }}
      {...dropHandlers}
    >
      {!blank ? (
        <Centered>
          <p className="text-sm text-muted-foreground">Pick a blank from the catalog to start designing</p>
          <Link to="/catalog" className="rounded-full bg-primary px-5 py-2 text-[13px] font-semibold text-primary-foreground">
            Browse catalog
          </Link>
        </Centered>
      ) : config.isError ? (
        <Centered>
          <p className="text-sm font-medium text-foreground">Couldn't load this product</p>
          <p className="text-xs text-muted-foreground">{config.error instanceof Error ? config.error.message : "Something went wrong"}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => void config.refetch()} className="rounded-full bg-primary px-5 py-2 text-[13px] font-semibold text-primary-foreground">
              Try again
            </button>
            <button onClick={goBack} className="rounded-full bg-muted px-5 py-2 text-[13px] font-medium text-foreground">
              Go back
            </button>
          </div>
        </Centered>
      ) : !product ? (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="animate-brand-loader h-2 w-2 rounded-full bg-foreground" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-xs tracking-wide text-muted-foreground">Preparing studio</p>
        </div>
      ) : (
        <>
          <div className="absolute inset-0">
            <StudioCanvas />
          </div>
          <TopBar onSave={handleSave} onBack={() => void requestBack()} />

          {mode === "edit" ? (
            <>
              {isMobile ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 safe-bottom">
                  <div className="glass pointer-events-auto w-full max-w-md rounded-[26px] border border-border p-1.5 shadow-glass">
                    <DockHeader onSave={handleSave} />
                    <ToolRail flat />
                  </div>
                </div>
              ) : (
                <div className="pointer-events-none absolute left-5 top-1/2 z-20 -translate-y-1/2">
                  <ToolRail />
                </div>
              )}
              {isMobile ? <MobilePanel /> : <DesktopPanel />}
              {panel === "adjust" && <AdjustSheet />}
            </>
          ) : (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 p-3 safe-bottom sm:p-5">
              {isMobile && (
                <div className="glass pointer-events-auto w-full max-w-md rounded-[22px] border border-border p-1.5 shadow-glass">
                  <DockHeader onSave={handleSave} />
                </div>
              )}
              <PreviewDock />
            </div>
          )}
          <SaveDialog open={savedOpen} onOpenChange={setSavedOpen} captures={captures} result={result} onReview={handleReview} />
          {confirmModal}
          {saveStep && (
            <StudioOverlay
              title="Saving your design…"
              detail="Please keep this screen open."
              steps={SAVE_STEPS.map<OverlayStep>((st, idx) => ({
                label: st.label,
                state: idx < saveIndex ? "done" : idx === saveIndex ? "active" : "todo",
              }))}
            />
          )}
          {!saveStep && modelLoading && !canvasError && <StudioOverlay title="Loading 3D preview…" />}
          {canvasError && (
            <StudioOverlay
              tone="error"
              title="3D preview unavailable"
              detail={canvasError}
              onRetry={() => window.location.reload()}
              retryLabel="Reload studio"
            />
          )}
          {dragging && !saveStep && (
            <div className="pointer-events-none fixed inset-0 z-[150] grid place-items-center bg-background/50 backdrop-blur-[2px]">
              <div className="rounded-3xl border-2 border-dashed border-foreground/40 bg-background/80 px-8 py-6 text-center">
                <p className="text-sm font-semibold text-foreground">Drop to add artwork</p>
                <p className="mt-1 text-xs text-muted-foreground">It lands on the active print area</p>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
