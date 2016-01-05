import Foo from '../Foo'

@asyncComponent(Foo)
@asyncLoadingElement(<div>loading...</div>)
export default class Example {
  render() {
    return <div>
      {this.props.shouldShowFirstFoo && <Foo color="red" />}
      {this.props.shouldShowSecondFoo && <Foo color="red" />}
    </div>
  }
}
