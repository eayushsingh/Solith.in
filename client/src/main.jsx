import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('CRASH:', error.message, error.stack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight:'100vh', background:'#0d1117', color:'white',
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'center', padding:20
        }}>
          <h1 style={{color:'#f87171', fontSize:24, marginBottom:16}}>
            App Crashed
          </h1>
          <pre style={{
            color:'#fbbf24', fontSize:13, background:'rgba(255,255,255,0.05)',
            padding:20, borderRadius:8, maxWidth:'80vw', overflow:'auto',
            whiteSpace:'pre-wrap', wordBreak:'break-all'
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop:24, padding:'12px 32px', background:'#1877f2',
              border:'none', borderRadius:10, color:'white',
              fontWeight:700, fontSize:16, cursor:'pointer'
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

async function bootstrap() {
  try {
    const { default: App } = await import('./App.jsx');
    ReactDOM.createRoot(document.getElementById('root')).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (e) {
    console.error('BOOTSTRAP FAILED:', e);
    document.getElementById('root').innerHTML = `
      <div style="min-height:100vh;background:#0d1117;color:white;display:flex;
        flex-direction:column;align-items:center;justify-content:center;padding:20px;
        font-family:monospace">
        <h1 style="color:#f87171;font-size:24px;margin-bottom:16px">Failed to load app</h1>
        <pre style="color:#fbbf24;font-size:13px;background:rgba(255,255,255,0.05);
          padding:20px;border-radius:8px;max-width:80vw;overflow:auto;
          white-space:pre-wrap;word-break:break-all">${e.message}\n\n${e.stack}</pre>
        <button onclick="location.reload()" style="margin-top:24px;padding:12px 32px;
          background:#1877f2;border:none;border-radius:10px;color:white;
          font-weight:700;font-size:16px;cursor:pointer">Reload</button>
      </div>
    `;
  }
}

bootstrap();
