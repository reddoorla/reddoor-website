import { redirectToPreviewURL } from '@prismicio/svelte/kit';
import { createClient } from '$lib/prismicio.js';

// src/routes/preview/+server.js
export async function GET({ fetch, request, cookies }) {
	// Add a response header for debugging
	const headers = new Headers();
	headers.append('x-debug-url', request.url);

	cookies.set('io.prismic.preview', '', {
		path: '/',
		secure: true,
		sameSite: 'lax'
	  });
	
	
	const client = createClient({ fetch });
	try {
	  const response = await redirectToPreviewURL({ client, request, cookies });
	  return response;
	} catch (error:any) {

	  return new Response(`Preview Error: ${error.message}`, {
		status: 500,
		headers
	  });
	}
  }