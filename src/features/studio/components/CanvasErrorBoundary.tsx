// src/features/studio/components/CanvasErrorBoundary.tsx

import React from "react";
import {
  Link,
} from "@tanstack/react-router";

interface Props {
  children: React.ReactNode;
  onError?: (error: unknown) => void;
}

interface State {
  hasError: boolean;
}

export class CanvasErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Studio canvas crashed:", error);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background/95 px-6 text-center backdrop-blur-xl">
          <div className="flex h-full w-full max-w-sm flex-1 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
            Unable to load 3D preview.
          </div>
          <Link
            to="/designs"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      );
    }

    return this.props.children;
  }
}