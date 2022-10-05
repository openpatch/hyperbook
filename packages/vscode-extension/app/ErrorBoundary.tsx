import React, { Component, ReactNode } from "react";

export type ErrorBoundaryProps = {
  message?: string;
  children: ReactNode;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  { error: any; errorInfo: any }
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Catch errors in any components below and re-render with error message
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
    // You can also log error messages to an error reporting service here
  }

  render() {
    if (this.state.errorInfo) {
      return (
        <div className="error-boundary">
          <h1>{this.props.message}</h1>
          <details style={{ whiteSpace: "pre-wrap" }}>
            <p>{this.state.error && this.state.error.toString()}</p>
            <p>{this.state.errorInfo.componentStack} </p>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
