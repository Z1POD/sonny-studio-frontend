"use client";
import type { ReactNode } from "react";
import { motion } from "framer-motion";

export function PlaceholderPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-10 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl border border-dashed border-border bg-surface/60 p-10 text-center"
      >
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
        {children && <div className="mt-6">{children}</div>}
      </motion.div>
    </div>
  );
}
