import { Loader2 } from "lucide-react";

interface QuickBtnProps {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  loading?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}

export function QuickBtn({
  onClick,
  title,
  loading,
  danger,
  children,
}: QuickBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-sm transition disabled:opacity-40 ${
        danger
          ? "border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500/40"
          : "border-white/30 bg-black/40 text-white/80 hover:bg-black/60"
      }`}
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : children}
    </button>
  );
}