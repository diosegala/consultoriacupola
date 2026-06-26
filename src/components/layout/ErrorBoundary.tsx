import { Component, ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 space-y-3">
          <h2 className="text-lg font-semibold text-destructive">Algo deu errado nesta tela</h2>
          <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded border border-border overflow-auto max-h-[60vh]">
{String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </pre>
          <button
            className="text-sm underline text-primary"
            onClick={() => this.setState({ error: null })}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}