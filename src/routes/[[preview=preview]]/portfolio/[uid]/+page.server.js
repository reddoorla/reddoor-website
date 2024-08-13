import { createClient } from '$lib/prismicio';

export async function load({ params, fetch, cookies }) {
	const client = createClient({ fetch, cookies });

	const page = await client.getByUID('project', params.uid);

	const allProjects = await client.getAllByType('project', {
		fetch: 'project.uid',
		orderings: {
		  field: 'document.first_publication_date',
		  direction: 'desc'
		}
	  });

	  const currentIndex = allProjects.findIndex(project => project.uid === params.uid);
	  const prevProject = allProjects[currentIndex + 1] || null;
	  const nextProject = allProjects[currentIndex - 1] || null;
	  

	return {
		page,
		title: page.data.title,
		meta_description: page.data.meta_description,
		meta_title: page.data.meta_title,
		meta_image: page.data.meta_image.url,
		prevProject,
		nextProject
	};
}

export async function entries() {
	const client = createClient();

	const pages = await client.getAllByType('project');

	return pages.map((page) => {
		return { uid: page.uid };
	});
}
