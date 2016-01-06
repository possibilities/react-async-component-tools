import Foo from '../Foo'

@asyncComponent(Foo)
@asyncLoadingElement(React.DOM.div(null, 'loading...'))
export default class Example {
  render() {
    return React.DOM.div(
      null,
      this.props.shouldShowFoo && React.createElement(Foo, { color: 'red' })
    )
  }
}
