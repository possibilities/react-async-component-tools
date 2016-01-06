import path from 'path'
import fs from 'fs'
import assert from 'assert'
import { transform } from 'babel-core'

const babelConfig = {
  plugins: [
    'syntax-jsx',
    'syntax-decorators',
    '../../../src',
  ]
}

// Define all the examples up front for legibility

const failsNoLoadingElementDecorator = `
import Foo from '../Foo'

@asyncComponent(Foo)
export default class Example {
  render() {
    return <div>
      {this.props.shouldShowFoo && <Foo color="red" />}
    </div>
  }
}
`

const failsNoComponentDecorator = `
import Foo from '../Foo'

@asyncLoadingElement(<div>loading...</div>)
export default class Example {
  render() {
    return <div>
      {this.props.shouldShowFoo && <Foo color="red" />}
    </div>
  }
}
`

const failsNoArgumentsToComponentDecorator = `
import Foo from '../Foo'

@asyncComponent()
@asyncLoadingElement(<div>loading...</div>)
export default class Example {
  render() {
    return <div>
      {this.props.shouldShowFoo && <Foo color="red" />}
    </div>
  }
}
`

const failsTooManyArgumentsToComponentDecorator = `
import Foo from '../Foo'

@asyncComponent(Foo, 123)
@asyncLoadingElement(<div>loading...</div>)
export default class Example {
  render() {
    return <div>
      {this.props.shouldShowFoo && <Foo color="red" />}
    </div>
  }
}
`

const failsNonIdentifierArgumentsToComponentDecorator = `
import Foo from '../Foo'

@asyncComponent('a string')
@asyncLoadingElement(<div>loading...</div>)
export default class Example {
  render() {
    return <div>
      {this.props.shouldShowFoo && <Foo color="red" />}
    </div>
  }
}
`

const failsNoArgumentsToLoadingElementDecorator = `
import Foo from '../Foo'

@asyncComponent(Foo)
@asyncLoadingElement()
export default class Example {
  render() {
    return <div>
      {this.props.shouldShowFoo && <Foo color="red" />}
    </div>
  }
}
`

const failsTooManyArgumentsToLoadingElementDecorator = `
import Foo from '../Foo'

@asyncComponent('a string')
@asyncLoadingElement(<div>loading...</div>, <div>loading...</div>)
export default class Example {
  render() {
    return <div>
      {this.props.shouldShowFoo && <Foo color="red" />}
    </div>
  }
}
`

describe('Ambient decorator plugin', () => {
  describe('failure scenarios', () => {
    it('no loading element decorator', () => {
      assert.throws(() => {
        transform(failsNoLoadingElementDecorator, babelConfig)
      }, /One `@asyncLoadingElement` decorator is needed/)
    })

    it('no component decorator', () => {
      assert.throws(() => {
        transform(failsNoComponentDecorator, babelConfig)
      }, /one or more `@asyncComponent` decorators/)
    })

    describe('component decorator', () => {
      it('has no arguments', () => {
        assert.throws(() => {
          transform(failsNoArgumentsToComponentDecorator, babelConfig)
        }, /`@asyncComponent` decorator requires a single argument/)
      })

      it('has too many arguments', () => {
        assert.throws(() => {
          transform(failsTooManyArgumentsToComponentDecorator, babelConfig)
        }, /`@asyncComponent` decorator requires a single argument/)
      })

      it('has a non-identifier argument', () => {
        assert.throws(() => {
          transform(failsNonIdentifierArgumentsToComponentDecorator, babelConfig)
        }, /must be an identifier/)
      })

    })
    describe('loading element decorator', () => {
      it('has no arguments', () => {
        assert.throws(() => {
          transform(failsNoArgumentsToLoadingElementDecorator, babelConfig)
        }, /`@asyncLoadingElement` decorator requires a single argument/)
      })

      it('has too many arguments', () => {
        assert.throws(() => {
          transform(failsTooManyArgumentsToLoadingElementDecorator, babelConfig)
        }, /`@asyncLoadingElement` decorator requires a single argument/)
      })
    })
  })
})
