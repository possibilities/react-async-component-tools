const {
  injectAsyncComponent
} = require("react-async-component-tools/lib/AsyncComponentContainer");

export default injectAsyncComponent("Foo", <div>loading...</div>, onReady => {
  require.ensure("../FooComponents", require => {
    const {
      Foo
    } = require("../FooComponents").default;

    onReady(Foo);
  });
});class Example {
  render() {
    const {
      Foo
    } = this.props;

    return <div>
      {this.props.shouldShowFoo && <Foo color="red" />}
    </div>;
  }
}
