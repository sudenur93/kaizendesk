import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // production'da buraya Sentry / log servisi eklenebilir
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message || 'Bilinmeyen hata';

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          background: 'var(--bg, #f9fafb)',
          fontFamily: 'var(--font, system-ui, sans-serif)',
          textAlign: 'center',
        }}
      >
        {/* İkon */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'color-mix(in oklab, #ef4444 12%, var(--bg, #f9fafb))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            fontSize: 28,
          }}
        >
          ⚠️
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: '0 0 8px',
            color: 'var(--text, #111)',
          }}
        >
          Bir şeyler ters gitti
        </h1>

        <p
          style={{
            fontSize: 14,
            color: 'var(--text-2, #555)',
            maxWidth: 400,
            margin: '0 0 24px',
            lineHeight: 1.6,
          }}
        >
          Sayfa beklenmedik bir hatayla karşılaştı. Ana sayfaya dönmek için aşağıdaki butona tıklayın.
        </p>

        {/* Hata detayı (geliştirici için) */}
        {import.meta.env.DEV && (
          <details
            style={{
              maxWidth: 500,
              width: '100%',
              textAlign: 'left',
              marginBottom: 24,
              background: 'var(--surface, #fff)',
              border: '1px solid var(--hairline, #e5e7eb)',
              borderRadius: 8,
              padding: '10px 14px',
            }}
          >
            <summary
              style={{
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--text-2, #555)',
              }}
            >
              Hata detayı (geliştirici)
            </summary>
            <pre
              style={{
                fontSize: 11,
                color: '#ef4444',
                marginTop: 8,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {msg}
            </pre>
          </details>
        )}

        <button
          type="button"
          onClick={() => this.handleReset()}
          style={{
            padding: '10px 24px',
            background: 'var(--accent, #111)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Ana Sayfaya Dön
        </button>
      </div>
    );
  }
}
