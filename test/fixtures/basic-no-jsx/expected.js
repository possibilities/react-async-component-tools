const {
  injectAsyncComponent
} = require('react-async-component-tools/lib/AsyncComponentContainer');

export default injectAsyncComponent('Foo', React.DOM.div(null, 'loading...'), onReady => {
  require.ensure('../Foo', require => {
    const Foo = require('../Foo').default;

    onReady(Foo);
  });
});class Example {
  render() {
    const {
      Foo
    } = this.props;

    return React.DOM.div(null, this.props.shouldShowFoo && React.createElement(Foo, { color: 'red' }));
  }
}
