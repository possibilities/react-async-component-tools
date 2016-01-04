import React, { Component, PropTypes } from 'react'

// A helper for building up an async component that stands in for the targeted
// component
export function createAsyncComponent(asyncComponentProps) {
  // A stateless react component, applies all appropriate props
  // to the container and underlying component
  return function(targetComponentProps) {
    return (
      <AsyncComponentContainer
        { ...asyncComponentProps }
        { ...targetComponentProps }
      />
    )
  }
}

// A decorator for creating and injecting async components
export function injectAsyncComponent(name, loadingElement, ensureComponent) {
  const wrappedComponentProps = {
    [name]: createAsyncComponent({ loadingElement, ensureComponent })
  }

  return function wrapWithAsyncComponent(WrappedComponent) {
    // A stateless react component, injects the wrapped component with
    // asyc component
    return function(targetComponentProps) {
      return (
        <WrappedComponent
          { ...wrappedComponentProps }
          { ...targetComponentProps }
        />
      )
    }
  }
}

// A container that shows a loading indicator until the targeted component is
// loaded
export default class AsyncComponentContainer extends Component {
  static propTypes = {
    loadingElement: PropTypes.element.isRequired,
    ensureComponent: PropTypes.func.isRequired,
  }

  constructor() {
    super()
    this.state = { AsyncComponent: null }
  }

  componentDidMount() {
    this.props.ensureComponent((AsyncComponent) => {
      this.setState({ AsyncComponent })
    })
  }

  render() {
    const { AsyncComponent } = this.state
    const { loadingElement, ...asyncComponentProps } = this.props

    if (AsyncComponent) {
      return <AsyncComponent { ...asyncComponentProps } />
    } else {
      return loadingElement
    }
  }
}
