// src/features/studio/components/CanvasErrorBoundary.tsx


import React from "react";

interface Props {
  children: React.ReactNode;
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
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
          Unable to load 3D preview.
        </div>
      );
    }

    return this.props.children;
  }
}