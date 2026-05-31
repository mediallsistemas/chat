'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPwaBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Persist across sessions so we don't nag on every new tab/visit.
    const stored = localStorage.getItem('pwa-install-dismissed')
    if (stored) {
      setDismissed(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!promptEvent) return
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    if (outcome === 'accepted') {
      setPromptEvent(null)
    }
  }

  function handleDismiss() {
    localStorage.setItem('pwa-install-dismissed', '1')
    setDismissed(true)
    setPromptEvent(null)
  }

  if (!promptEvent || dismissed) return null

  return (
    // Anchored bottom-left so it doesn't overlap the bottom-right toasts.
    <div className="fixed bottom-4 left-4 z-40 w-full max-w-sm pr-4">
      <div className="bg-gd text-white rounded-xl shadow-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gn flex items-center justify-center shrink-0">
          <span className="text-gd font-bold text-lg leading-none">M</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Instalar Mediall</p>
          <p className="text-xs text-white/70 mt-0.5">Adicione à tela inicial para acesso rápido</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 bg-gn text-gd text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            Instalar
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 text-white/60 hover:text-white transition-colors"
            aria-label="Fechar"
          >
            <i className="ti ti-x text-sm" />
          </button>
        </div>
      </div>
    </div>
  )
}
