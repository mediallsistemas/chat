'use client'

import { useState } from 'react'
import { api } from '@/lib/api'
import { useUnitStore } from '@/store/unit-store'
import { toast } from '@/hooks/use-toast'
import { getErrorMessage } from '@/lib/get-error-message'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function useDownloadImpedimentsPdf() {
  const { activeUnit } = useUnitStore()
  const [isPending, setIsPending] = useState(false)

  async function download() {
    if (!activeUnit?.id) return
    setIsPending(true)
    try {
      const res = await api.get(`/units/${activeUnit.id}/reports/impediments/pdf`, {
        responseType: 'blob',
      })
      triggerDownload(res.data as Blob, `impedimentos-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setIsPending(false)
    }
  }

  return { download, isPending }
}

export function useDownloadImpedimentsExcel() {
  const { activeUnit } = useUnitStore()
  const [isPending, setIsPending] = useState(false)

  async function download() {
    if (!activeUnit?.id) return
    setIsPending(true)
    try {
      const res = await api.get(`/units/${activeUnit.id}/reports/impediments/excel`, {
        responseType: 'blob',
      })
      triggerDownload(res.data as Blob, `impedimentos-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setIsPending(false)
    }
  }

  return { download, isPending }
}

export function useDownloadDashboardPdf() {
  const { activeUnit } = useUnitStore()
  const [isPending, setIsPending] = useState(false)

  async function download() {
    if (!activeUnit?.id) return
    setIsPending(true)
    try {
      const res = await api.get(`/units/${activeUnit.id}/reports/dashboard/pdf`, {
        responseType: 'blob',
      })
      triggerDownload(res.data as Blob, `relatorio-executivo-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setIsPending(false)
    }
  }

  return { download, isPending }
}
