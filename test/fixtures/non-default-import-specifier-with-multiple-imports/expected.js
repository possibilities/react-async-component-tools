const {
  injectAsyncComponent
} = require('react-async-component-tools/lib/AsyncComponentContainer');

import { FooNonAsync } from '../FooComponents';
import { BarNonAsync } from '../BarComponents';

export default injectAsyncComponent('Foo', <div>loading...</div>, onReady => {
  require.ensure('../FooComponents', require => {
    const {
      Foo
    } = require('../FooComponents').default;

    onReady(Foo);
  });
});injectAsyncComponent('Bar', <div>loading...</div>, onReady => {
  require.ensure('../BarComponents', require => {
    const {
      Bar
    } = require('../BarComponents').default;

    onReady(Bar);
  });
});class Example {
  render() {
    const {
      Bar
    } = this.props;
    const {
      Foo
    } = this.props;

    return <div>
      {this.props.shouldShowFoo && <Foo color="red" />}
      {this.props.shouldShowBar && <Bar color="blue" />}
    </div>;
  }
}
