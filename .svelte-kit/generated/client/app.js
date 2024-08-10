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
	() => import('./nodes/20')
];

export const server_loads = [0];

export const dictionary = {
		"/about": [4],
		"/blogs": [5],
		"/contacts": [6],
		"/content": [7],
		"/ctas": [8],
		"/faqs": [9],
		"/footers": [10],
		"/lists": [11],
		"/mastheads": [12],
		"/navs": [13],
		"/plans": [14],
		"/portfolios": [15],
		"/slice-simulator": [16],
		"/sliders": [17],
		"/teams": [18],
		"/testimonials": [19],
		"/values": [20],
		"/[[preview=preview]]": [2],
		"/[[preview=preview]]/[uid]": [~3]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),

	reroute: (() => {})
};

export { default as root } from '../root.svelte';