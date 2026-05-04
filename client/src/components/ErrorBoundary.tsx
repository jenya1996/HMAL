import React from 'react';

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', gap: '16px',
          background: '#0f172a', color: '#f1f5f9',
        }}>
          <div style={{ fontSize: '48px' }}>⚠️</div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Something went wrong</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8', maxWidth: '400px', textAlign: 'center' }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
            style={{
              padding: '10px 24px', borderRadius: '8px', border: 'none',
              background: '#2563eb', color: 'white', fontSize: '14px',
              fontWeight: '600', cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
