// src/features/studio/components/ProgressReporter.tsx

import { useEffect } from "react";
import * as THREE from "three";

interface ProgressReporterProps {
  onLoadingChange?: (loading: boolean, progress: number) => void;
}

export function ProgressReporter({ onLoadingChange }: ProgressReporterProps) {
  useEffect(() => {
    const manager = THREE.DefaultLoadingManager;
    let cancelled = false;

    const computeAndReport = () => {
      const { itemsLoaded, itemsTotal } = manager;
      const active = itemsTotal > 0 && itemsLoaded < itemsTotal;
      const progress = itemsTotal > 0 ? (itemsLoaded / itemsTotal) * 100 : 100;
      queueMicrotask(() => {
        if (!cancelled) onLoadingChange?.(active, progress);
      });
    };

    // Catch up with anything that already happened before this effect
    // had a chance to subscribe.
    computeAndReport();

    const prevOnStart = manager.onStart;
    const prevOnProgress = manager.onProgress;
    const prevOnLoad = manager.onLoad;
    const prevOnError = manager.onError;

    manager.onStart = (url, loaded, total) => {
      prevOnStart?.(url, loaded, total);
      computeAndReport();
    };
    manager.onProgress = (url, loaded, total) => {
      prevOnProgress?.(url, loaded, total);
      computeAndReport();
    };
    manager.onLoad = () => {
      prevOnLoad?.();
      computeAndReport();
    };
    manager.onError = (url) => {
      prevOnError?.(url);
      computeAndReport();
    };

    return () => {
      cancelled = true;
      manager.onStart = prevOnStart;
      manager.onProgress = prevOnProgress;
      manager.onLoad = prevOnLoad;
      manager.onError = prevOnError;
    };
  }, [onLoadingChange]);

  return null;
}