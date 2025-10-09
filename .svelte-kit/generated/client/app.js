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
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14')
];

export const server_loads = [0];

export const dictionary = {
		"/[[preview=preview]]/about": [~7],
		"/[[preview=preview]]/contact": [~8],
		"/[[preview=preview]]/portfolio": [~9],
		"/[[preview=preview]]/portfolio/[uid]": [~10,[],[3]],
		"/[[preview=preview]]/showcase": [11],
		"/[[preview=preview]]/showcase/[uid]": [~12,[],[4]],
		"/slice-simulator": [14],
		"/[[preview=preview]]/twenty-for-twenty": [~13],
		"/[[preview=preview]]": [~5],
		"/[[preview=preview]]/[uid]": [~6,[],[2]]
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