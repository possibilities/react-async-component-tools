import Foo from '../Foo'

@asyncComponent(Foo)
@asyncLoadingElement(<div>loading...</div>)
export default class Example {
  render() {
    return <div>
      {this.props.shouldShowFoo && <Foo color="red" />}
    </div>
  }
}
