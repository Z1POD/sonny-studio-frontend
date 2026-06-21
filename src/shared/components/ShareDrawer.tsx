/**
 * src/shared/components/ShareDrawer.tsx — v2
 *
 * Apple HIG–inspired share sheet.
 *
 * Design principles applied:
 *  - Frosted glass bottom sheet with spring animation (matching iOS share sheet feel)
 *  - Pill drag handle, rounded corners, clean hierarchy
 *  - Social icons in a single horizontal scroll row with circular buttons
 *  - No borders on icon cells — colour IS the affordance
 *  - Subtle haptic-style spring on mount; tap targets ≥ 44pt
 *  - Telegram Story share gets prominent CTA when available (primary brand colour)
 *  - Product preview at top: blurred backdrop + centred image (like AirDrop preview)
 *  - Actions in a grouped "menu card" with inset separators (iOS Settings style)
 *  - Copy link shows inline checkmark confirmation instead of toast
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  Send,
  Instagram,
  Twitter,
  Facebook,
  Music2,
  Link2,
  MessageCircle,
  X,
  Check,
  ExternalLink,
  Loader2,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOverlayStore } from "@/shared/stores/overlay-store";
import { useTelegram } from "@/shared/hooks/use-telegram";
import { storeProductApi } from "@/features/store/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShareTarget {
  title: string;
  url: string;
  imageUrl?: string;
  productId?: string;
  /** If true, auto-publishes the product before sharing */
  shouldPublish?: boolean;
}

// ─── Icon wrappers ─────────────────────────────────────────────────────────────

/** TikTok SVG (not in lucide) */
function TikTokIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
    </svg>
  );
}

/** WhatsApp SVG */
function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

// ─── Social button configs ────────────────────────────────────────────────────

interface SocialBtn {
  id: string;
  label: string;
  icon: React.ReactNode;
  bg: string;
  action: (url: string, title: string) => void;
}

const SOCIAL_BUTTONS: SocialBtn[] = [
  {
    id: "telegram",
    label: "Telegram",
    icon: <Send className="h-[18px] w-[18px]" />,
    bg: "#229ED9",
    action: (url, title) =>
      window.open(
        `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
        "_blank",
        "noopener,noreferrer",
      ),
  },
  {
    id: "x",
    label: "X (Twitter)",
    icon: <Twitter className="h-[18px] w-[18px]" />,
    bg: "#000000",
    action: (url, title) =>
      window.open(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
        "_blank",
        "noopener,noreferrer",
      ),
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: <WhatsAppIcon size={18} />,
    bg: "#25D366",
    action: (url, title) =>
      window.open(
        `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
        "_blank",
        "noopener,noreferrer",
      ),
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: <Instagram className="h-[18px] w-[18px]" />,
    bg: "linear-gradient(135deg, #f0339e 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #8e18bc 100%)",
    action: (url, title) => {
      navigator.clipboard.writeText(`${title} — ${url}`);
      toast.success("Caption copied — paste it in Instagram.");
    },
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: <Facebook className="h-[18px] w-[18px]" />,
    bg: "#1877F2",
    action: (url) =>
      window.open(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        "_blank",
        "noopener,noreferrer",
      ),
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: <TikTokIcon size={18} />,
    bg: "#010101",
    action: (url, title) => {
      navigator.clipboard.writeText(`${title} — ${url}`);
      toast.success("Caption copied — paste it in TikTok.");
    },
  },
  {
    id: "messages",
    label: "Messages",
    icon: <MessageCircle className="h-[18px] w-[18px]" />,
    bg: "#34C759",
    action: (url, title) =>
      window.open(`sms:?body=${encodeURIComponent(`${title} ${url}`)}`),
  },
];

// ─── SocialIcon ───────────────────────────────────────────────────────────────

function SocialIcon({ btn, url, title, onDone }: {
  btn: SocialBtn;
  url: string;
  title: string;
  onDone: () => void;
}) {
  const isGradient = btn.bg.startsWith("linear");

  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={() => {
        btn.action(url, title);
        if (btn.id !== "instagram" && btn.id !== "tiktok") {
          setTimeout(onDone, 350);
        }
      }}
      className="flex flex-col items-center gap-2 min-w-[60px] flex-shrink-0 select-none"
    >
      <div
        className="flex h-8 w-8 items-center justify-center rounded-[14px] text-white shadow-sm"
        style={
          isGradient
            ? { background: btn.bg }
            : { backgroundColor: btn.bg }
        }
      >
        {btn.icon}
      </div>
      <span className="text-[11px] font-medium text-foreground/70 leading-tight text-center w-full">
        {btn.label}
      </span>
    </motion.button>
  );
}

// ─── MenuRow ──────────────────────────────────────────────────────────────────

function MenuRow({
  icon,
  label,
  rightContent,
  onClick,
  destructive = false,
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  rightContent?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  last?: boolean;
}) {
  return (
    <>
      <motion.button
        whileTap={{ backgroundColor: "rgba(0,0,0,0.04)" }}
        onClick={onClick}
        className={`flex w-full items-center gap-3.5 px-4 py-[13px] text-left transition-colors active:bg-black/5 dark:active:bg-white/5 ${
          destructive ? "text-red-500" : "text-foreground"
        }`}
      >
        <span className={`flex-shrink-0 ${destructive ? "text-red-500" : "text-foreground/60"}`}>
          {icon}
        </span>
        <span className="flex-1 text-[15px] font-normal">{label}</span>
        {rightContent && (
          <span className="flex-shrink-0 text-foreground/40">{rightContent}</span>
        )}
      </motion.button>
      {!last && <div className="h-px bg-border/40 ml-12" />}
    </>
  );
}

// ─── ShareDrawerContent ───────────────────────────────────────────────────────

interface ShareDrawerContentProps {
  target: ShareTarget;
  onClose: () => void;
}

export function ShareDrawerContent({ target, onClose }: ShareDrawerContentProps) {
  const [copied, setCopied] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const { isInTelegramMiniApp, isShareToStoryAvailable, shareToStory, hapticFeedback } =
    useTelegram();

  const inTelegram = isInTelegramMiniApp() && isShareToStoryAvailable();

  const handlePublishAndShare = useCallback(async () => {
    if (!target.productId) { toast.error("Product ID not available"); return; }
    setIsPublishing(true);
    try {
      await storeProductApi.publish(target.productId);
      toast.success("Published!");
      if (inTelegram && target.imageUrl) {
        hapticFeedback("success");
        shareToStory(target.imageUrl, target.title, { url: target.url, name: "View Product" });
        toast.info("Story editor opened.");
      }
    } catch (err: any) {
      toast.error(err?.data?.error?.message ?? err?.message ?? "Failed to publish");
    } finally {
      setIsPublishing(false);
    }
  }, [target, inTelegram, shareToStory, hapticFeedback]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(target.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: target.title, text: target.title, url: target.url });
      onClose();
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="flex flex-col overflow-hidden">
      {/* Product preview */}
      {target.imageUrl && (
        <div className="relative mx-4 mt-3 mb-1 overflow-hidden rounded-2xl bg-surface-overlay">
          {/* blurred backdrop */}
          <div
            className="absolute inset-0 scale-110 blur-xl opacity-60"
            style={{ backgroundImage: `url(${target.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
            aria-hidden
          />
          <img
            src={target.imageUrl}
            alt={target.title}
            className="relative z-10 mx-auto block max-h-[38vh] w-auto object-contain"
            style={{ aspectRatio: "4/5" }}
          />
        </div>
      )}

      {/* Title + URL */}
      <div className="px-5 pt-4 pb-3">
        <p className="text-[17px] font-semibold tracking-tight text-foreground leading-snug line-clamp-2">
          {target.title}
        </p>
        <p className="mt-0.5 text-[12px] text-muted-foreground truncate">{target.url}</p>
      </div>

      {/* ── Telegram Story CTA (inside Telegram Mini App) ── */}
      {inTelegram && (
        <div className="px-4 pb-3">
          <Button
            onClick={handlePublishAndShare}
            disabled={isPublishing}
            className="w-full h-[50px] rounded-2xl text-[15px] font-semibold gap-2"
            style={{ backgroundColor: "#229ED9", borderColor: "#229ED9" }}
          >
            {isPublishing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isPublishing ? "Publishing…" : "Share to Story"}
          </Button>
        </div>
      )}

      {/* ── Social icon row (non-Telegram / always shown outside TG) ── */}
      {!inTelegram && (
        <div className="px-5 pb-4">
          <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
            {/* Native share (first slot, if available) */}
            {typeof navigator !== "undefined" && "share" in navigator && (
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={handleNativeShare}
                className="flex flex-col items-center gap-2 min-w-[60px] flex-shrink-0 select-none"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary text-primary-foreground shadow-sm">
                  <Share2 className="h-[18px] w-[18px]" />
                </div>
                <span className="text-[11px] font-medium text-foreground/70 leading-tight text-center w-full">
                  Share
                </span>
              </motion.button>
            )}

            {/* Copy link */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={copyLink}
              className="flex flex-col items-center gap-2 min-w-[60px] flex-shrink-0 select-none"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-surface-elevated border border-border/50 text-foreground shadow-sm">
                {copied ? (
                  <Check className="h-[18px] w-[18px] text-green-500" />
                ) : (
                  <Link2 className="h-[18px] w-[18px]" />
                )}
              </div>
              <span className="text-[11px] font-medium text-foreground/70 leading-tight text-center w-full">
                {copied ? "Copied!" : "Copy Link"}
              </span>
            </motion.button>

            {/* Social channels */}
            {SOCIAL_BUTTONS.map((btn) => (
              <SocialIcon
                key={btn.id}
                btn={btn}
                url={target.url}
                title={target.title}
                onDone={onClose}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Action menu card ── */}
      <div className="mx-4 mb-8 overflow-hidden rounded-2xl bg-surface-elevated border border-border/40">
        <MenuRow
          icon={<X className="h-4 w-4" />}
          label="Close"
          onClick={onClose}
          last
        />
      </div>
    </div>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useShareDrawer() {
  const openSheet = useOverlayStore((s) => s.openSheet);
  const closeSheet = useOverlayStore((s) => s.closeSheet);

  const openShareDrawer = useCallback(
    (target: ShareTarget) => {
      const sheetId = openSheet({
        title: null,
        content: (
          <ShareDrawerContent
            target={target}
            onClose={() => closeSheet(sheetId)}
          />
        ),
        dismissible: true,
      });
      return sheetId;
    },
    [openSheet, closeSheet],
  );

  return { openShareDrawer };
}

// ─── Standalone trigger ───────────────────────────────────────────────────────

interface ShareDrawerTriggerProps {
  children: React.ReactNode;
  target: ShareTarget;
  className?: string;
}

export function ShareDrawerTrigger({ children, target, className }: ShareDrawerTriggerProps) {
  const { openShareDrawer } = useShareDrawer();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); openShareDrawer(target); }}
      className={className}
    >
      {children}
    </button>
  );
}