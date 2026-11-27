import { useState } from "react";
import type { User } from "@/shared/api/types";
import { cn } from "@/lib/utils";

/** Avatar from the user's profile photo (copied from Telegram by the backend); initials when missing or broken. */
export function UserAvatar({ user, className }: { user: Pick<User, "display_name" | "photo_url">; className?: string }) {
  const [failed, setFailed] = useState(false);
  const initials = (user.display_name || "?").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const base = "grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 font-semibold text-primary";
  return user.photo_url && !failed ? (
    <img
      src={user.photo_url}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn(base, "object-cover", className)}
    />
  ) : (
    <span aria-hidden className={cn(base, className)}>{initials}</span>
  );
}
