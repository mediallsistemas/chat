import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Per-request tenant context (multitenancy — plano 23.2).
 *
 * Set by `TenantGuard` from the validated JWT's `tenantId`, and read by the
 * Prisma tenant extension (plano 23.3) to auto-scope every query to the current
 * tenant. Using the Node built-in AsyncLocalStorage keeps this dependency-free;
 * the request lifecycle (guard → interceptor → handler → service) runs in a
 * single async context, so `enterWith` in the guard propagates downstream.
 */
export interface TenantStore {
  tenantId: string
}

export const tenantStorage = new AsyncLocalStorage<TenantStore>()

/** Current tenant id for this request, or undefined outside a tenant context (e.g. jobs). */
export function getCurrentTenantId(): string | undefined {
  return tenantStorage.getStore()?.tenantId
}

/**
 * Run `fn` with NO tenant context, so the Prisma auto-scope middleware no-ops
 * and queries see every tenant (multitenancy plano 26.5).
 *
 * The ONLY authorized caller is the `platform` context (the SaaS owner), which
 * legitimately operates across all tenants behind `PlatformAdminGuard`. Never
 * use this from a tenant-facing service — it defeats the isolation boundary.
 */
export function runWithoutTenant<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.exit(fn)
}

/**
 * Extract the tenant slug from the request Host header (multitenancy plano 23.4).
 * Returns null when there's no tenant subdomain (dev/localhost, raw IP, apex or
 * www/api host) — the host check then becomes a no-op, so local dev is unaffected.
 *
 * Examples (with APP_BASE_DOMAIN="app.com"): acme.app.com → "acme"; app.com → null;
 * acme.localhost → "acme"; localhost → null; 127.0.0.1 → null.
 */
export function extractTenantSlugFromHost(host?: string): string | null {
  if (!host) return null
  const h = host.split(':')[0].toLowerCase()
  const parts = h.split('.')

  // Dev convenience: <slug>.localhost
  if (parts[parts.length - 1] === 'localhost') {
    return parts.length >= 2 ? parts[0] : null
  }
  // Raw IPv4 → no slug
  if (/^\d+(\.\d+)*$/.test(h)) return null

  const base = process.env.APP_BASE_DOMAIN?.toLowerCase()
  if (base && h !== base && h.endsWith('.' + base)) {
    const slug = h.slice(0, -(base.length + 1)).split('.')[0]
    if (slug && slug !== 'www' && slug !== 'api') return slug
  }
  return null
}
