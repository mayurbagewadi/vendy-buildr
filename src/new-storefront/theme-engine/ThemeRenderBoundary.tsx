import { Component, type ReactNode } from "react";

type ThemeRenderBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
};

type ThemeRenderBoundaryState = {
  hasError: boolean;
};

class ThemeRenderBoundary extends Component<ThemeRenderBoundaryProps, ThemeRenderBoundaryState> {
  state: ThemeRenderBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ThemeRenderBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[ThemeRenderBoundary] Theme render failed; falling back to core storefront.", error);
    this.props.onError?.(error);
  }

  componentDidUpdate(prevProps: ThemeRenderBoundaryProps) {
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

export default ThemeRenderBoundary;
