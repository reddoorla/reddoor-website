export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10')
];

export const server_loads = [0];

export const dictionary = {
		"/[[preview=preview]]/about": [~4],
		"/[[preview=preview]]/contact": [~5],
		"/[[preview=preview]]/portfolio": [~6],
		"/[[preview=preview]]/portfolio/[uid]": [~7],
		"/[[preview=preview]]/showcase/[uid]": [~8],
		"/slice-simulator": [10],
		"/[[preview=preview]]/slider-test": [9],
		"/[[preview=preview]]": [~2],
		"/[[preview=preview]]/[uid]": [~3]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.svelte';