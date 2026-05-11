import { Processor, Process } from '@nestjs/bull'
import { Job } from 'bull'
import * as nodemailer from 'nodemailer'
import { EmailJob } from './mail.service'

@Processor('email')
export class MailProcessor {
  private transporter: nodemailer.Transporter

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }

  @Process('send-notification')
  async handleSendNotification(job: Job<EmailJob>) {
    const { to, name, title, body, actionUrl } = job.data

    const html = this.buildHtml({ name, title, body, actionUrl })

    await this.transporter.sendMail({
      from: `"Mediall Brasil" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject: title,
      html,
    })
  }

  private buildHtml({
    name,
    title,
    body,
    actionUrl,
  }: Pick<EmailJob, 'name' | 'title' | 'body' | 'actionUrl'>) {
    const button = actionUrl
      ? `<a href="${actionUrl}" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#005CA9;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Ver detalhes</a>`
      : ''

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
        <tr><td style="background:#005CA9;padding:24px 32px">
          <span style="color:#fff;font-size:20px;font-weight:700">Mediall Brasil</span>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 8px;font-size:14px;color:#6b7280">Olá, ${name}</p>
          <h1 style="margin:0 0 16px;font-size:18px;color:#111827">${title}</h1>
          <p style="margin:0;font-size:15px;color:#374151;line-height:1.6">${body}</p>
          ${button}
        </td></tr>
        <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
          <p style="margin:0;font-size:12px;color:#9ca3af">Este e-mail foi enviado automaticamente pela plataforma Mediall Brasil. Não responda a este e-mail.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  }
}
