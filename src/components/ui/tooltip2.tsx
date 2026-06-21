"use client";

import React from "react";

export default function Tooltip({
  children,
  text,
}: {
  children: React.ReactNode;
  text: string;
}) {
  return (
    <div className="relative group inline-flex">
      {children}

      <div
        className="
          pointer-events-none
          absolute left-1/2 -translate-x-1/2 -top-10
          hidden group-hover:block
          whitespace-nowrap
          rounded-md
          bg-primary
          px-2 py-1
          text-xs
          text-primary-foreground
          shadow-lg
        "
      >
        {text}
      </div>
    </div>
  );
}