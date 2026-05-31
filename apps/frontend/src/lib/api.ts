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

api.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') return config

  config.headers['x-correlation-id'] = crypto.randomUUID()

  const method = config.method?.toUpperCase()
  if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    config.headers['x-csrf-token'] = await getCsrfToken()
  }
  return config
})

// Single-flight refresh: concurrent 401s share one /auth/refresh call.
let refreshing: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = axios
      .post(`${baseURL}/auth/refresh`, null, { withCredentials: true })
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      error.response?.status === 403 &&
      error.response?.data?.message === 'invalid csrf token'
    ) {
      csrfToken = null
      const newToken = await getCsrfToken()
      error.config.headers['x-csrf-token'] = newToken
      return api.request(error.config)
    }

    const correlationId = error.response?.data?.correlationId
    if (error.response?.status >= 500 && correlationId) {
      console.error(`Error [${correlationId}]:`, error.message)
    }

    const isAuthEndpoint = error.config?.url?.includes('/auth/')
    if (error.response?.status === 401 && !isAuthEndpoint && !error.config?._retried) {
      // Access token likely expired — try a silent refresh, then replay once.
      const ok = await tryRefresh()
      if (ok) {
        error.config._retried = true
        return api.request(error.config)
      }
      if (typeof window !== 'undefined') window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)
