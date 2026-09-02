import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] App crashed:', error.message, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0d1117',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'white', fontFamily: 'monospace', padding: 20
        }}>
          <h2 style={{ color: '#f87171', marginBottom: 16 }}>Something went wrong</h2>
          <pre style={{
            color: 'rgba(255,255,255,0.6)', fontSize: 12,
            background: 'rgba(255,255,255,0.05)', padding: 16,
            borderRadius: 8, maxWidth: 600, overflow: 'auto'
          }}>
            {this.state.error?.message}
          </pre>
          <button onClick={() => window.location.reload()} style={{
            marginTop: 20, padding: '10px 24px', borderRadius: 8,
            background: '#1877f2', border: 'none', color: 'white',
            fontWeight: 700, cursor: 'pointer', fontSize: 14
          }}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
