import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('Page render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
<<<<<<< HEAD
          color: 'var(--text-secondary)'
=======
          color: 'var(--text-muted)'
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
        }}>
          <h3 style={{ marginBottom: '12px' }}>
            This page had an error
          </h3>
          <p style={{
            fontSize: '0.85rem',
            marginBottom: '20px'
          }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() =>
              this.setState({ hasError: false, error: null })
            }
            style={{
              padding: '10px 24px',
<<<<<<< HEAD
              background: 'var(--primary)',
=======
              background: 'var(--neon-green-dark)',
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
