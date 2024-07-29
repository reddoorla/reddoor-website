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
	() => import('./nodes/19')
];

export const server_loads = [0];

export const dictionary = {
		"/blogs": [4],
		"/contacts": [5],
		"/content": [6],
		"/ctas": [7],
		"/faqs": [8],
		"/footers": [9],
		"/lists": [10],
		"/mastheads": [11],
		"/navs": [12],
		"/plans": [13],
		"/portfolios": [14],
		"/slice-simulator": [15],
		"/sliders": [16],
		"/teams": [17],
		"/testimonials": [18],
		"/values": [19],
		"/[[preview=preview]]": [2],
		"/[[preview=preview]]/[uid]": [~3]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),

	reroute: (() => {})
};

export { default as root } from '../root.svelte';