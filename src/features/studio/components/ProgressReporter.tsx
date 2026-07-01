// src/features/studio/components/ProgressReporter.tsx

import { useEffect } from "react";
import { useProgress } from "@react-three/drei";

interface ProgressReporterProps {
  onLoadingChange?: (loading: boolean, progress: number) => void;
}

export function ProgressReporter({ onLoadingChange }: ProgressReporterProps) {
  const { active, progress } = useProgress();

  useEffect(() => {
    onLoadingChange?.(active, progress);
  }, [active, progress, onLoadingChange]);

  return null;
}