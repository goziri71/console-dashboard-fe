import { Component } from 'react'

/** Catches render crashes so a bad audit payload cannot blank the whole console. */
export default class CommandCenterErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[command-center] render error', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="animate-fade-in-up rounded-card border border-error/40 bg-error-bg p-6">
          <h1 className="text-xl font-semibold text-text-primary">Command Center hit an error</h1>
          <p className="mt-2 text-sm text-error">
            {this.state.error?.message || 'Something went wrong while rendering the live wall.'}
          </p>
          <button
            type="button"
            className="mt-4 rounded-full border border-border bg-card px-4 py-2 text-sm text-text-primary hover:bg-card-hover"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
