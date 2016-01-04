const {
  injectAsyncComponent
} = require("babel-plugin-async-component/lib/AsyncComponentContainer");

export default injectAsyncComponent("Foo", <div>loading...</div>, onReady => {
  require.ensure("../Foo", require => {
    const Foo = require("../Foo").default;

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
