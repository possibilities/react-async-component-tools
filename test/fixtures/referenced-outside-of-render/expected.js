const {
  injectAsyncComponent
} = require("babel-plugin-async-component/lib/AsyncComponentContainer");

export default injectAsyncComponent("Foo", <div>loading...</div>, onReady => {
  require.ensure("../Foo", require => {
    const Foo = require("../Foo").default;

    onReady(Foo);
  });
});class Example {
  renderHelper() {
    const {
      Foo
    } = this.props;

    return <Foo color="red" />;
  }

  render() {
    return <div>
      {this.props.shouldShowFoo && this.renderHelper()}
    </div>;
  }
}
