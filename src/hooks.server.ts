// src/hooks.server.ts
import { createClient } from '$lib/prismicio'
import type { Handle } from '@sveltejs/kit'
import type { CookieSerializeOptions } from 'cookie'

export const handle: Handle = async ({ event, resolve }) => {
  // Set preview cookie defaults
  const previewCookie = event.cookies.get('io.prismic.preview') || ''
  const previewSessionCookie = event.cookies.get('io.prismic.previewSession') || ''

  // Set secure cookie attributes
  const cookieOptions: CookieSerializeOptions & { path: string } = {
    path: '/',
    secure: true,
    sameSite: 'lax',
    httpOnly: true
  }

  event.cookies.set('io.prismic.preview', previewCookie, cookieOptions)
  event.cookies.set('io.prismic.previewSession', previewSessionCookie, cookieOptions)

  // Initialize Prismic client with preview data
  event.locals.prismic = {
    client: createClient({ fetch: event.fetch }),
    previewData: previewCookie ? { ref: previewCookie } : null
  }

  return resolve(event)
}