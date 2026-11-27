import { Component, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { StudioOverlay } from "./StudioOverlay";

interface State {
  error: Error | null;
}

interface Props {
  children: ReactNode;
  /** When given, the boundary reports the failure and renders nothing so the caller can show its own fallback. */
  onError?: () => void;
  /** Model URL to drop from drei's cache on retry (a failed load is otherwise remembered). */
  modelUrl?: string;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch() {
    this.props.onError?.();
  }

  private retry = () => {
    if (this.props.modelUrl) useGLTF.clear(this.props.modelUrl);
    this.setState({ error: null });
  };

  override render() {
    if (!this.state.error) return this.props.children;
    if (this.props.onError) return null;
    return (
      <StudioOverlay
        tone="error"
        title="3D preview unavailable"
        detail="The model or canvas couldn't load. Check your connection and try again."
        onRetry={this.retry}
        onSecondary={() => window.location.reload()}
        secondaryLabel="Reload"
      />
    );
  }
}
