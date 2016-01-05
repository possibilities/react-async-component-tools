const {
  injectAsyncComponent
} = require("react-async-component-tools/lib/AsyncComponentContainer");

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
      {this.props.shouldShowFirstFoo && <Foo color="red" />}
      {this.props.shouldShowSecondFoo && <Foo color="red" />}
    </div>;
  }
}
