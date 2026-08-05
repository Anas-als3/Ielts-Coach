import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last line of defence: a render error anywhere in the tree shows a recoverable
 * card instead of a blank page. Session data lives in localStorage, so nothing
 * is lost by reloading.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('IELTS Coach render error:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', padding: 24 }}>
          <div className="card" style={{ maxWidth: 480, padding: 32, textAlign: 'center' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--ink-soft)', marginBottom: 8 }}>
              The app hit an unexpected error while drawing this screen. Your essays are saved on
              this device and are not affected.
            </p>
            <p className="mono" style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 16 }}>
              {this.state.error.message}
            </p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload the app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
