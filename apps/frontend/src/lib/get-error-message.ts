import axios from 'axios'

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.message
    if (typeof msg === 'string') return msg
    if (Array.isArray(msg)) return msg.join(', ')
    return `Erro ${err.response?.status ?? 'de rede'}`
  }
  if (err instanceof Error) return err.message
  return 'Erro inesperado. Tente novamente.'
}
