import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6 bg-page-bg">
      <p className="text-5xl font-bold text-gd font-sora">404</p>
      <div>
        <p className="text-base font-semibold text-gray-800">Página não encontrada</p>
        <p className="text-sm text-gx mt-1 max-w-xs">
          O endereço acessado não existe ou foi movido.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="px-4 py-2 text-sm font-semibold rounded-xl bg-gd text-white hover:opacity-90 transition-opacity"
      >
        Voltar ao início
      </Link>
    </div>
  )
}
