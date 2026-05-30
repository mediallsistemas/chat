'use client'

import { useState } from 'react'
import { api } from '@/shared/lib/api'
import { useUnitStore } from '@/shared/store/unit-store'

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
    } finally {
      setIsPending(false)
    }
  }

  return { download, isPending }
}

export function useDownloadDashboardExcel() {
  const { activeUnit } = useUnitStore()
  const [isPending, setIsPending] = useState(false)

  async function download() {
    if (!activeUnit?.id) return
    setIsPending(true)
    try {
      const res = await api.get(`/units/${activeUnit.id}/reports/dashboard/excel`, {
        responseType: 'blob',
      })
      triggerDownload(res.data as Blob, `relatorio-executivo-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } finally {
      setIsPending(false)
    }
  }

  return { download, isPending }
}
