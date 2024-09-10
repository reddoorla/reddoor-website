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
	() => import('./nodes/24')
];

export const server_loads = [0];

export const dictionary = {
		"/[[preview=preview]]/about": [~4],
		"/blogs": [9],
		"/contacts": [10],
		"/[[preview=preview]]/contact": [~5],
		"/content": [11],
		"/ctas": [12],
		"/faqs": [13],
		"/footers": [14],
		"/lists": [15],
		"/mastheads": [16],
		"/navs": [17],
		"/plans": [18],
		"/portfolios": [19],
		"/[[preview=preview]]/portfolio": [~6],
		"/[[preview=preview]]/portfolio/[uid]": [~7],
		"/[[preview=preview]]/showcase/[uid]": [~8],
		"/slice-simulator": [20],
		"/sliders": [21],
		"/teams": [22],
		"/testimonials": [23],
		"/values": [24],
		"/[[preview=preview]]": [~2],
		"/[[preview=preview]]/[uid]": [~3]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),

	reroute: (() => {})
};

export { default as root } from '../root.svelte';