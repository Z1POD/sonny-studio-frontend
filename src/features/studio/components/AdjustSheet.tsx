import { useRef } from "react";
import { RotateCw, Maximize2, X, Trash2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStudio } from "../store";
import type { Layer, PrintZone } from "../types";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

type DragMode = "move" | "resize" | "rotate";

function BoardLayer({
  layer,
  selected,
  boardRef,
}: {
  layer: Layer;
  selected: boolean;
  boardRef: React.RefObject<HTMLDivElement | null>;
}) {
  const select = useStudio((s) => s.select);
  const updateTransform = useStudio((s) => s.updateTransform);
  const t = layer.transform;

  function start(e: React.PointerEvent, mode: DragMode) {
    e.stopPropagation();
    e.preventDefault();
    select(layer.id);
    if (layer.locked) return;
    const board = boardRef.current?.getBoundingClientRect();
    if (!board) return;
    const cx = board.left + board.width / 2 + (t.x * board.width) / 2;
    const cy = board.top + board.height / 2 - (t.y * board.height) / 2;
    const startX = e.clientX;
    const startY = e.clientY;
    const startDist = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    const init = { ...t };

    const move = (ev: PointerEvent) => {
      if (mode === "move") {
        updateTransform(layer.id, {
          x: clamp(init.x + ((ev.clientX - startX) / board.width) * 2, -1, 1),
          y: clamp(init.y - ((ev.clientY - startY) / board.height) * 2, -1, 1),
        });
      } else if (mode === "resize") {
        const d = Math.hypot(ev.clientX - cx, ev.clientY - cy);
        updateTransform(layer.id, { scale: clamp(init.scale * (d / startDist), 0.05, 1.2) });
      } else {
        const a = Math.atan2(ev.clientY - cy, ev.clientX - cx);
        let deg = init.rotation + ((a - startAngle) * 180) / Math.PI;
        deg = ((((deg + 180) % 360) + 360) % 360) - 180;
        if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
        updateTransform(layer.id, { rotation: Math.round(deg) });
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const lines = layer.kind === "text" ? (layer.text || " ").split("\n") : [];
  const handle =
    "absolute flex h-6 w-6 items-center justify-center rounded-full border border-border-strong bg-background text-foreground shadow-elevated touch-none";

  return (
    <div
      onPointerDown={(e) => start(e, "move")}
      className={cn(
        "absolute touch-none select-none",
        layer.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
        !layer.visible && "opacity-30",
      )}
      style={{
        left: `${50 + t.x * 50}%`,
        top: `${50 - t.y * 50}%`,
        height: `${t.scale * 100}%`,
        transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`,
        opacity: layer.visible ? t.opacity : 0.3,
      }}
    >
      {layer.kind === "text" ? (
        <div
          className="flex h-full flex-col justify-center whitespace-pre leading-[1.18]"
          style={{
            fontFamily: layer.fontFamily,
            fontWeight: layer.fontWeight,
            fontStyle: layer.italic ? "italic" : "normal",
            color: layer.color,
            textAlign: layer.align,
            letterSpacing: `${layer.letterSpacing * 0.01}em`,
            // font-size relative to the box height (container query units)
            fontSize: `calc(100cqh * ${t.scale / (1.18 * lines.length + 0.2)})`,
            padding: "0 0.2em",
          }}
        >
          {lines.map((l, i) => (
            <span key={i}>{l || " "}</span>
          ))}
        </div>
      ) : (
        <img src={layer.src} alt={layer.name} draggable={false} className="pointer-events-none h-full w-auto max-w-none" />
      )}
      {selected && (
        <>
          <span className="pointer-events-none absolute -inset-1 rounded-[4px] border-[1.5px] border-ring" />
          {!layer.locked && (
            <>
              <button
                aria-label="Rotate"
                onPointerDown={(e) => start(e, "rotate")}
                className={cn(handle, "-top-9 left-1/2 -translate-x-1/2 cursor-alias")}
              >
                <RotateCw className="h-3 w-3" />
              </button>
              <button
                aria-label="Resize"
                onPointerDown={(e) => start(e, "resize")}
                className={cn(handle, "-bottom-3.5 -right-3.5 cursor-nwse-resize")}
              >
                <Maximize2 className="h-3 w-3 rotate-90" />
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ZoneBoard({ zone }: { zone: PrintZone }) {
  const layers = useStudio((s) => s.layers);
  const selectedId = useStudio((s) => s.selectedId);
  const select = useStudio((s) => s.select);
  const colorHex = useStudio((s) => s.product?.colors.find((c) => c.id === s.colorId)?.hex);
  const ref = useRef<HTMLDivElement>(null);
  const zoneLayers = layers.filter((l) => l.zoneId === zone.id);
  const aspect = zone.size[0] / zone.size[1];

  return (
    <div className="flex h-full min-h-0 items-center justify-center">
      <div
        ref={ref}
        onPointerDown={() => select(null)}
        className="relative h-full max-w-full overflow-visible rounded-[14px] border-[1.5px] border-dashed border-ring shadow-elevated [container-type:size]"
        style={{ aspectRatio: String(aspect), backgroundColor: colorHex }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[13px] bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:10%_10%]" />
        <span className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-ring/30" />
        <span className="pointer-events-none absolute left-0 top-1/2 h-px w-full bg-ring/30" />
        {zoneLayers.map((l) => (
          <BoardLayer key={l.id} layer={l} selected={l.id === selectedId} boardRef={ref} />
        ))}
        {zoneLayers.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground">
            Add artwork or text to this zone
          </p>
        )}
      </div>
    </div>
  );
}

export function AdjustSheet() {
  const product = useStudio((s) => s.product);
  const activeZone = useStudio((s) => s.activeZone);
  const setZone = useStudio((s) => s.setZone);
  const setPanel = useStudio((s) => s.setPanel);
  const selectedId = useStudio((s) => s.selectedId);
  const layers = useStudio((s) => s.layers);
  const { removeLayer, duplicateLayer } = useStudio.getState();
  const zone = product?.printZones.find((z) => z.id === activeZone) ?? product?.printZones[0];
  if (!product || !zone) return null;
  const selected = layers.find((l) => l.id === selectedId && l.zoneId === zone.id);

  return (
    <section
      aria-label="Adjust design"
      className="glass animate-studio-rise pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex h-[50dvh] flex-col rounded-t-[28px] border-t border-border shadow-glass safe-bottom md:inset-x-auto md:left-1/2 md:h-[65dvh] md:max-h-[calc(100dvh-110px)] md:w-[min(760px,calc(100vw-220px))] md:-translate-x-1/2"
    >
      <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong" />
      <div className="flex items-center gap-2 px-4 pb-2 pt-2.5">
        <div className="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
          {product.printZones.map((z) => (
            <button
              key={z.id}
              onClick={() => setZone(z.id)}
              aria-pressed={activeZone === z.id}
              className={cn(
                "h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[12px] font-medium transition-all",
                activeZone === z.id ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:text-foreground",
              )}
            >
              {z.label}
            </button>
          ))}
        </div>
        {selected && (
          <>
            <button aria-label="Duplicate layer" onClick={() => duplicateLayer(selected.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/70 text-muted-foreground hover:text-foreground">
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button aria-label="Delete layer" onClick={() => removeLayer(selected.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/70 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <button aria-label="Close adjust" onClick={() => setPanel(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/70 text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 px-10 pb-6 pt-8">
        <ZoneBoard zone={zone} />
      </div>
      <p className="pb-3 text-center text-[11px] text-muted-foreground">
        {zone.printAreaCm[0]} × {zone.printAreaCm[1]} cm · drag to move · corner to resize · top handle to rotate
      </p>
    </section>
  );
}
