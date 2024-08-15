import { createClient } from '$lib/prismicio';

export async function load({ params, fetch, cookies }) {
	const client = createClient({ fetch, cookies });

	

	const allProjects = await client.getAllByType('project', {
		orderings: {
		  field: 'document.first_publication_date',
		  direction: 'asc'
		}
	  });

	  

	return {
		allProjects: allProjects,
	};
}
