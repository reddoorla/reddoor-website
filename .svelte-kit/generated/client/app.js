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
	() => import('./nodes/23')
];

export const server_loads = [0];

export const dictionary = {
		"/about": [6],
		"/blogs": [7],
		"/contacts": [9],
		"/contact": [8],
		"/content": [10],
		"/ctas": [11],
		"/faqs": [12],
		"/footers": [13],
		"/lists": [14],
		"/mastheads": [15],
		"/navs": [16],
		"/plans": [17],
		"/portfolios": [18],
		"/[[preview=preview]]/portfolio": [~4],
		"/[[preview=preview]]/portfolio/[uid]": [~5],
		"/slice-simulator": [19],
		"/sliders": [20],
		"/teams": [21],
		"/testimonials": [22],
		"/values": [23],
		"/[[preview=preview]]": [~2],
		"/[[preview=preview]]/[uid]": [~3]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),

	reroute: (() => {})
};

export { default as root } from '../root.svelte';