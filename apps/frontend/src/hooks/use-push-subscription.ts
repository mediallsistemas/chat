'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

export function usePushSubscription() {
  const [isSupported, setIsSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    setIsSupported('serviceWorker' in navigator && 'PushManager' in window)
  }, [])

  useEffect(() => {
    if (!isSupported) return
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription()
      setIsSubscribed(!!sub)
    })
  }, [isSupported])

  const subscribe = useCallback(async () => {
    if (!isSupported) return
    setIsLoading(true)
    try {
      const { data } = await api.get<{ data: { publicKey: string | null } }>('/push/public-key')
      const publicKey = data.data.publicKey
      if (!publicKey) return

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })

      const json = sub.toJSON()
      await api.post('/push/subscribe', {
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      })
      setIsSubscribed(true)
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return
    setIsLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await api.delete(`/push/unsubscribe?endpoint=${encodeURIComponent(sub.endpoint)}`)
        await sub.unsubscribe()
        setIsSubscribed(false)
      }
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  return { isSupported, isSubscribed, isLoading, subscribe, unsubscribe }
}
