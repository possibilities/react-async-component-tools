import Foo from '../Foo'

@asyncComponent(Foo)
@asyncLoadingElement(<div>loading...</div>)
export default class Example {
  renderHelper() {
   return <Foo color="red" />
  }

  render() {
    return <div>
      {this.props.shouldShowFoo && this.renderHelper()}
    </div>
  }
}
