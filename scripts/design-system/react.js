import { mount, unmount, createRawSnippet, flushSync } from "svelte";
import { reactiveProps } from "./props.svelte.js";

const SLOT = '<span data-rd-slot style="display:contents"></span>';
const SNIPPET = Symbol.for("reddoor.snippet");
let nextSlot = 0;

export function snippet(render) {
  return { [SNIPPET]: render };
}

function isNode(React, value) {
  if (Array.isArray(value)) return value.some((v) => isNode(React, v));
  return React.isValidElement(value);
}

function isSnippet(React, key, value) {
  if (value && value[SNIPPET]) return true;
  if (key === "children") return value != null && value !== false;
  return isNode(React, value);
}

function renderOf(value) {
  return value && value[SNIPPET] ? value[SNIPPET] : () => value;
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
    const [slots, setSlots] = React.useState([]);
    const [, setTick] = React.useState(0);
    const keys = Object.keys(props).filter((k) => isSnippet(React, k, props[k]));
    const signature = keys.join("|");

    const toSvelte = (snippets) => {
      const out = {};
      for (const [k, v] of Object.entries(props)) out[k] = k in snippets ? snippets[k] : v;
      return out;
    };

    React.useEffect(() => {
      const snippets = {};
      for (const k of keys) {
        snippets[k] = createRawSnippet((...getters) => ({
          render: () => SLOT,
          setup(node) {
            const id = ++nextSlot;
            setSlots((s) => [...s, { id, key: k, node, getters }]);
            return () => setSlots((s) => s.filter((x) => x.id !== id));
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
        setSlots([]);
      };
    }, [signature]);

    React.useEffect(() => {
      const current = live.current;
      if (!current) return;
      sync(current.bag, current.last, toSvelte(current.snippets));
      if (slots.length) {
        flushSync();
        setTick((t) => t + 1);
      }
    }, [props]);

    const portals = slots
      .filter((s) => s.key in props)
      .map((s) =>
        window.ReactDOM.createPortal(
          renderOf(props[s.key])(...s.getters.map((g) => g())),
          s.node,
          s.id,
        ),
      );
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
  target.snippet = snippet;
  target.svelte = {
    components: svelte,
    mount: (name, element, props = {}) => mount(svelte[name], { target: element, props }),
    unmount,
    createRawSnippet,
  };
  return target;
}
