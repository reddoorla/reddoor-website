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
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19'),
	() => import('./nodes/20'),
	() => import('./nodes/21'),
	() => import('./nodes/22'),
	() => import('./nodes/23'),
	() => import('./nodes/24'),
	() => import('./nodes/25')
];

export const server_loads = [0];

export const dictionary = {
		"/[[preview=preview]]/about": [~4],
		"/blogs": [10],
		"/contacts": [11],
		"/[[preview=preview]]/contact": [~5],
		"/content": [12],
		"/ctas": [13],
		"/faqs": [14],
		"/footers": [15],
		"/lists": [16],
		"/mastheads": [17],
		"/navs": [18],
		"/plans": [19],
		"/portfolios": [20],
		"/[[preview=preview]]/portfolio": [~6],
		"/[[preview=preview]]/portfolio/[uid]": [~7],
		"/[[preview=preview]]/showcase/[uid]": [~8],
		"/slice-simulator": [21],
		"/[[preview=preview]]/slider-test": [9],
		"/sliders": [22],
		"/teams": [23],
		"/testimonials": [24],
		"/values": [25],
		"/[[preview=preview]]": [~2],
		"/[[preview=preview]]/[uid]": [~3]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.svelte';