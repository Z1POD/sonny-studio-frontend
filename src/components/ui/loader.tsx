import { cn } from "@/lib/utils";

interface BrandLoaderProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-2 w-2 gap-1.5",
  md: "h-3 w-3 gap-2.5",
  lg: "h-4 w-4 gap-3",
};

export function BrandLoader({
  size = "md",
  className,
}: BrandLoaderProps) {
  const [dot, gap] = sizes[size].split(" gap-");

  return (
    <div
      className={cn(
        "flex items-center",
        `gap-${gap}`,
        className,
      )}
    >
      {[0, 150, 300].map((delay, i) => (
        <span
          key={i}
          className={cn(
            dot,
            "rounded-full animate-brand-loader",
            i === 0 ? "bg-[#857134]" : i === 1 ? "bg-white/90" : "bg-[#2A8C72]" 
          )}
          style={{
            animationDelay: `${delay}ms`,
            animationDuration: "1.1s",
          }}
        />
      ))}
    </div>
  );
}