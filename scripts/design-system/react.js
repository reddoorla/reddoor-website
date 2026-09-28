import { mount, unmount, createRawSnippet } from "svelte";
import { reactiveProps } from "./props.svelte.js";

const SLOT = '<span data-rd-slot style="display:contents"></span>';

function isNode(React, value) {
  if (Array.isArray(value)) return value.some((v) => isNode(React, v));
  return React.isValidElement(value);
}

function nodeKeys(React, props) {
  return Object.keys(props).filter((k) =>
    k === "children" ? props[k] != null && props[k] !== false : isNode(React, props[k]),
  );
}

function sync(bag, last, next) {
  for (const k of Object.keys(last)) {
    if (!(k in next)) {
      delete bag[k];
      delete last[k];
    }
  }
  for (const [k, v] of Object.entries(next)) {
    if (last[k] !== v) {
      bag[k] = v;
      last[k] = v;
    }
  }
}

export function wrap(Component, name) {
  function Wrapped(props) {
    const React = window.React;
    const host = React.useRef(null);
    const live = React.useRef(null);
    const [slots, setSlots] = React.useState({});
    const keys = nodeKeys(React, props);
    const signature = keys.join("|");

    const toSvelte = (snippets) => {
      const out = {};
      for (const [k, v] of Object.entries(props)) out[k] = k in snippets ? snippets[k] : v;
      return out;
    };

    React.useEffect(() => {
      const snippets = {};
      for (const k of keys) {
        snippets[k] = createRawSnippet(() => ({
          render: () => SLOT,
          setup(node) {
            setSlots((s) => ({ ...s, [k]: node }));
          },
        }));
      }
      const initial = toSvelte(snippets);
      const bag = reactiveProps({ ...initial });
      const last = { ...initial };
      const instance = mount(Component, { target: host.current, props: bag });
      live.current = { snippets, bag, last, instance };
      return () => {
        unmount(instance);
        live.current = null;
        setSlots({});
      };
    }, [signature]);

    React.useEffect(() => {
      const current = live.current;
      if (current) sync(current.bag, current.last, toSvelte(current.snippets));
    }, [props]);

    const portals = keys
      .filter((k) => slots[k])
      .map((k) => window.ReactDOM.createPortal(props[k], slots[k], k));
    return React.createElement(
      React.Fragment,
      null,
      React.createElement("div", { ref: host, style: { display: "contents" } }),
      ...portals,
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
    createRawSnippet,
  };
  return target;
}
