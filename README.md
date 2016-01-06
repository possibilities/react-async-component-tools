# React async component tools

Tools for declaratively loading react components on-demand

## Summary

Similar to [`react-proxy-loader`](https://github.com/webpack/react-proxy-loader) this module allows you to declaratively split components using webpack's "[code splitting](https://webpack.github.io/docs/code-splitting.html)" mechanism. There are 3 available methods:

1. Manually wrapping components in provided "higher order component" (HoC)
1. Wrapping components in provided decorator that applies the HoC in method No. 1
1. Using a small "ambient" decorator and use the provided babel transformation plugin to handle expanding out one or more decorators from method No. 2

## Usage

Using the babel plugin:

```
import Foo from '../Foo'
import Bar from '../Bar'
import Baz from '../Baz'

// Foo and Bar will load asynchronously, Baz will load normally
@asyncComponent(Foo)
@asyncComponent(Bar)
@asyncLoadingElement(<div>loading...</div>)
export default class Example {
  render() {
    return <div>
      {this.props.shouldShowFoo && <Foo color="red" />}
      {this.props.shouldShowBar && <Bar color="blue" />}
      {this.props.shouldShowBaz && <Baz color="green" />}
    </div>
  }
}
```

TODO add examples for methods 1 + 2

## TODO

* Don't assume `ImportDefaultSpecifier` (See https://github.com/babel/babel/blob/master/doc/ast/spec.md#importspecifier)
  - [x] Support `import { Foo } from '../Foo'
  - [x] Support `import { Foo, NonAsync } from '../Foo'
  - [ ] Support `import { Foo as Bar } from '../Foo'
  - [ ] Maybe support `import * as FooComponents from '../Foo'
* Test error cases in transform
* Test underlying components
* Organize repo sensibly (we provide 3 methods but the repo is named and organized only for the babel plugin). Will probably look like a mini-mono-repo when complete (i.e. one repo with 3 packages).
