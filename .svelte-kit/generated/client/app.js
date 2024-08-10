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
	() => import('./nodes/22')
];

export const server_loads = [0];

export const dictionary = {
		"/about": [4],
		"/blogs": [5],
		"/contacts": [7],
		"/contact": [6],
		"/content": [8],
		"/ctas": [9],
		"/faqs": [10],
		"/footers": [11],
		"/lists": [12],
		"/mastheads": [13],
		"/navs": [14],
		"/plans": [15],
		"/portfolios": [17],
		"/portfolio": [16],
		"/slice-simulator": [18],
		"/sliders": [19],
		"/teams": [20],
		"/testimonials": [21],
		"/values": [22],
		"/[[preview=preview]]": [2],
		"/[[preview=preview]]/[uid]": [~3]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),

	reroute: (() => {})
};

export { default as root } from '../root.svelte';