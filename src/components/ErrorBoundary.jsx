import { Component } from 'react';
import { logger } from '../config/logger';

/**
 * ErrorBoundary — captura errores en el renderizado de componentes hijos
 * y muestra un fallback en lugar de crashear toda la aplicación.
 * 
 * Uso:
 *   <ErrorBoundary fallback={<p>Algo salió mal</p>}>
 *     <ComponenteRiesgoso />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('ErrorBoundary', 'Error capturado:', error, errorInfo);
    this.setState({ error, errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback({ error: this.state.error, retry: this.handleRetry })
          : this.props.fallback;
      }

      // Fallback por defecto
      return (
        <div style={{
          padding: '2rem', textAlign: 'center',
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12, margin: '1rem 0',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚠️</div>
          <h3 style={{ color: '#fca5a5', marginBottom: '0.5rem' }}>Error inesperado</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            {this.state.error?.message || 'Ocurrió un error al renderizar este componente.'}
          </p>
          <details style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            <summary>Detalles técnicos</summary>
            <pre style={{ textAlign: 'left', overflow: 'auto', marginTop: '0.5rem', fontSize: '0.7rem' }}>
              {this.state.error?.stack || 'Sin stack trace'}
            </pre>
          </details>
          <button
            onClick={this.handleRetry}
            className="cw-btn cw-btn--secondary"
            style={{ fontSize: '0.82rem' }}
          >
            🔄 Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC: envuelve un componente con ErrorBoundary.
 * Uso: export default withErrorBoundary(MiComponente);
 */
export function withErrorBoundary(Component, fallbackProps = {}) {
  const Wrapped = (props) => (
    <ErrorBoundary {...fallbackProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  Wrapped.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;
  return Wrapped;
}
