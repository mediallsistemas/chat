// Slash commands para o chat. Cada comando recebe os args já parseados
// e um `ctx` com utilidades; retorna um SlashResult que diz ao caller o
// que fazer: enviar uma mensagem normal, executar um side-effect, ou
// reportar erro.

export interface SlashContext {
  groupId: string
  sendMessage: (content: string) => void
  createReminder: (input: { text: string; remindAt: string; groupId?: string }) => Promise<unknown>
}

export type SlashResult =
  | { kind: 'sent' }
  | { kind: 'error'; message: string }
  | { kind: 'noop'; message?: string }

export interface SlashCommand {
  name: string
  description: string
  usage: string
  run: (args: string, ctx: SlashContext) => Promise<SlashResult> | SlashResult
}

// ─── Time parsing: "5m", "2h", "1d" or HH:mm ──────────────────────────────────

const REL_TIME_RE = /^(\d+)\s*(m|min|h|hr|d|day)$/i
const ABS_TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

export function parseRemindAt(input: string, now: Date = new Date()): Date | null {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return null

  const rel = REL_TIME_RE.exec(trimmed)
  if (rel) {
    const n = Number(rel[1])
    if (!Number.isFinite(n) || n <= 0) return null
    const unit = rel[2].toLowerCase()
    const ms =
      unit.startsWith('d') ? n * 24 * 60 * 60_000 :
      unit.startsWith('h') ? n * 60 * 60_000 :
      n * 60_000 // m | min
    return new Date(now.getTime() + ms)
  }

  const abs = ABS_TIME_RE.exec(trimmed)
  if (abs) {
    const hh = Number(abs[1])
    const mm = Number(abs[2])
    const target = new Date(now)
    target.setHours(hh, mm, 0, 0)
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1)
    return target
  }

  return null
}

// ─── Built-in commands ────────────────────────────────────────────────────────

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'me',
    description: 'Envia uma mensagem em terceira pessoa.',
    usage: '/me <ação>',
    run(args, ctx) {
      const action = args.trim()
      if (!action) return { kind: 'error', message: 'Uso: /me <ação>' }
      ctx.sendMessage(`_${action}_`)
      return { kind: 'sent' }
    },
  },
  {
    name: 'shrug',
    description: 'Envia ¯\\_(ツ)_/¯.',
    usage: '/shrug [texto]',
    run(args, ctx) {
      const suffix = args.trim()
      const text = suffix ? `${suffix} ¯\\_(ツ)_/¯` : '¯\\_(ツ)_/¯'
      ctx.sendMessage(text)
      return { kind: 'sent' }
    },
  },
  {
    name: 'remind',
    description: 'Agenda um lembrete pessoal.',
    usage: '/remind <tempo|HH:mm> <texto>',
    async run(args, ctx) {
      const trimmed = args.trim()
      const firstSpace = trimmed.indexOf(' ')
      if (firstSpace === -1) {
        return { kind: 'error', message: 'Uso: /remind <tempo> <texto>. Ex: /remind 30m revisar PR' }
      }
      const timeToken = trimmed.slice(0, firstSpace)
      const text = trimmed.slice(firstSpace + 1).trim()
      if (!text) return { kind: 'error', message: 'Texto do lembrete obrigatório.' }

      const remindAt = parseRemindAt(timeToken)
      if (!remindAt) {
        return {
          kind: 'error',
          message: 'Tempo inválido. Use 5m, 2h, 1d ou HH:mm.',
        }
      }

      try {
        await ctx.createReminder({ text, remindAt: remindAt.toISOString(), groupId: ctx.groupId })
        return {
          kind: 'noop',
          message: `⏰ Lembrete agendado para ${remindAt.toLocaleString('pt-BR')}.`,
        }
      } catch (err) {
        const e = err as { response?: { data?: { message?: string } }; message?: string }
        return {
          kind: 'error',
          message: e.response?.data?.message ?? e.message ?? 'Falha ao criar lembrete.',
        }
      }
    },
  },
]

const COMMAND_MAP = new Map(SLASH_COMMANDS.map((c) => [c.name, c]))

export interface ParsedSlash {
  command: SlashCommand
  args: string
}

export function parseSlash(input: string): ParsedSlash | null {
  if (!input.startsWith('/')) return null
  const m = /^\/(\w+)(?:\s+([\s\S]*))?$/.exec(input)
  if (!m) return null
  const cmd = COMMAND_MAP.get(m[1].toLowerCase())
  if (!cmd) return null
  return { command: cmd, args: m[2] ?? '' }
}
