import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { handleApiRequest } from './api/routes'

const startHandler = createStartHandler(defaultStreamHandler)

export default {
  async fetch(request: Request, env: Record<string, string>) {
    // Set env vars for database access
    if (env?.DATABASE_URL) {
      process.env.DATABASE_URL = env.DATABASE_URL
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'access-control-allow-headers': 'content-type, authorization',
        },
      })
    }

    // Handle API routes before TanStack Start
    const apiResponse = handleApiRequest(request)
    if (apiResponse) {
      const response = await apiResponse
      response.headers.set('access-control-allow-origin', '*')
      response.headers.set('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS')
      response.headers.set('access-control-allow-headers', 'content-type, authorization')
      return response
    }

    // Fall through to TanStack Start
    return startHandler(request)
  },
}
