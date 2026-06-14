import axios from 'axios'

const baseURL = typeof window === 'undefined'
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1')
  : '/api/v1'

export const api = axios.create({
  baseURL,
  withCredentials: true,
})

let csrfToken: string | null = null

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken
  const res = await axios.get(`${baseURL}/auth/csrf-token`, { withCredentials: true })
  csrfToken = res.data.data?.csrfToken ?? res.data.csrfToken
  return csrfToken!
}

/**
 * The CSRF token is bound to the auth session (logged-out vs logged-in produce
 * different session identifiers), so any in-memory token cached before a
 * login/logout becomes stale. Call this to force a fresh fetch on the next
 * mutation. Exported so the login/logout flows can invalidate proactively.
 */
export function invalidateCsrfToken(): void {
  csrfToken = null
}

api.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') return config

  config.headers['x-correlation-id'] = crypto.randomUUID()

  const method = config.method?.toUpperCase()
  if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    config.headers['x-csrf-token'] = await getCsrfToken()
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Match by status + code, not message: the backend rewrites the csrf-csrf
    // message to "Invalid or missing CSRF token", so matching on the original
    // "invalid csrf token" string never fired and the retry was dead code.
    const data = error.response?.data
    const isCsrfError =
      error.response?.status === 403 &&
      (data?.code === 'EBADCSRFTOKEN' ||
        /csrf token/i.test(data?.message ?? ''))
    if (isCsrfError && !error.config?._csrfRetried) {
      csrfToken = null
      const newToken = await getCsrfToken()
      error.config._csrfRetried = true
      error.config.headers['x-csrf-token'] = newToken
      return api.request(error.config)
    }

    const correlationId = error.response?.data?.correlationId
    if (error.response?.status >= 500 && correlationId) {
      console.error(`Error [${correlationId}]:`, error.message)
    }

    const isAuthEndpoint = error.config?.url?.includes('/auth/')
    if (error.response?.status === 401 && !isAuthEndpoint && !error.config?._refreshed) {
      // Try silent token refresh before redirecting
      try {
        await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
        error.config._refreshed = true
        csrfToken = null
        return api.request(error.config)
      } catch {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)
