// src/routes/preview/+server.ts
import { redirectToPreviewURL } from '@prismicio/svelte/kit'
import { createClient } from '$lib/prismicio'

export async function GET({ fetch, request, cookies }) {
  const client = createClient({ fetch })
  
  try {
    const response = await redirectToPreviewURL({ 
      client, 
      request,
      cookies
    })

    // Explicitly set preview ref in cookie before redirect
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (token) {
      cookies.set('io.prismic.preview', token, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax'
      })
    }

    return response
  } catch (error:any) {
    console.error('Preview error:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}