import { mount, unmount, createRawSnippet } from "svelte";

const SLOT = '<span data-rd-slot style="display:contents"></span>';

export function wrap(Component, name) {
  function Wrapped(props) {
    const React = window.React;
    const host = React.useRef(null);
    const [slot, setSlot] = React.useState(null);
    React.useEffect(() => {
      const { children, ...rest } = props;
      const svelteProps = { ...rest };
      if (children != null) {
        svelteProps.children = createRawSnippet(() => ({
          render: () => SLOT,
          setup(node) {
            setSlot(node);
          },
        }));
      }
      const instance = mount(Component, { target: host.current, props: svelteProps });
      return () => {
        unmount(instance);
        setSlot(null);
      };
    }, [props]);
    return React.createElement(
      React.Fragment,
      null,
      React.createElement("div", { ref: host, style: { display: "contents" } }),
      slot && props.children != null ? window.ReactDOM.createPortal(props.children, slot) : null,
    );
  }
  Wrapped.displayName = name;
  return Wrapped;
}

export function expose(namespace, components) {
  const target = (window[namespace] ??= {});
  const svelte = {};
  for (const [name, Component] of Object.entries(components)) {
    target[name] = wrap(Component, name);
    svelte[name] = Component;
  }
  target.svelte = {
    components: svelte,
    mount: (name, element, props = {}) => mount(svelte[name], { target: element, props }),
    unmount,
  };
  return target;
}
