import { Foo, FooNonAsync } from '../FooComponents'
import { BarNonAsync, Bar } from '../BarComponents'

@asyncComponent(Foo)
@asyncComponent(Bar)
@asyncLoadingElement(<div>loading...</div>)
export default class Example {
  render() {
    return <div>
      {this.props.shouldShowFoo && <Foo color="red" />}
      {this.props.shouldShowBar && <Bar color="blue" />}
    </div>
  }
}
