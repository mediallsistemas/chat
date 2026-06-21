'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { getErrorMessage } from '@/shared/lib/get-error-message'
import { toast } from '@/shared/hooks/use-toast'
import type { SubscriptionView } from '@mediall/types'

/** Current tenant's subscription, plan limits and usage (plano 26.6). */
export function useMySubscription() {
  return useQuery<SubscriptionView>({
    queryKey: ['billing', 'me'],
    queryFn: async () => {
      const res = await api.get<{ data: SubscriptionView }>('/billing/me')
      return res.data.data
    },
    staleTime: 60_000,
    retry: false,
  })
}

/** Open the Stripe Billing Portal (manage card/invoices). Requires billing enabled. */
export function useBillingPortal() {
  return useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: { url: string } }>('/billing/portal', {})
      return res.data.data.url
    },
    onSuccess: (url) => {
      window.location.href = url
    },
    onError: (err) =>
      toast.error(getErrorMessage(err) || 'Não foi possível abrir o portal de pagamento.'),
  })
}

/** Start a Stripe Checkout session to subscribe/upgrade a tier price. */
export function useCheckout() {
  return useMutation({
    mutationFn: async (priceId: string) => {
      const res = await api.post<{ data: { url: string } }>('/billing/checkout', { priceId })
      return res.data.data.url
    },
    onSuccess: (url) => {
      window.location.href = url
    },
    onError: (err) =>
      toast.error(getErrorMessage(err) || 'Não foi possível iniciar o checkout.'),
  })
}

/** Invalidate the billing cache (e.g. after returning from Stripe). */
export function useRefreshBilling() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['billing'] })
}
