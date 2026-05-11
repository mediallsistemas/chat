import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ImpedimentStatus } from '@mediall/types'
import PDFDocument = require('pdfkit')
import * as ExcelJS from 'exceljs'

const BRAND_GREEN = '#2ECC71'
const BRAND_DARK = '#1A2E3B'
const GRAY = '#6B7280'

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async exportImpedimentsPdf(unitId: string): Promise<Buffer> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId }, select: { name: true } })
    const impediments = await this.prisma.taskImpediment.findMany({
      where: { unitId },
      include: { task: { select: { title: true } } },
      orderBy: [{ status: 'asc' }, { escalationLevel: 'desc' }, { createdAt: 'asc' }],
    })

    const blocked = impediments.filter((i) => i.status === ImpedimentStatus.BLOCKED).length
    const attention = impediments.filter((i) => i.status === ImpedimentStatus.ATTENTION).length
    const resolved = impediments.filter((i) => i.status === ImpedimentStatus.RESOLVED).length

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' })
      const chunks: Buffer[] = []
      doc.on('data', (c: Buffer) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Header
      doc.fillColor(BRAND_DARK).fontSize(22).font('Helvetica-Bold').text('Mediall Brasil', 50, 50)
      doc.fillColor(GRAY).fontSize(11).font('Helvetica').text('Relatório de Impedimentos', 50, 78)
      doc.fillColor(GRAY).fontSize(9).text(`Unidade: ${unit?.name ?? unitId}`, 50, 95)
      doc.fillColor(GRAY).fontSize(9).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 50, 108)

      doc.moveTo(50, 128).lineTo(545, 128).strokeColor(BRAND_GREEN).lineWidth(2).stroke()

      // Summary boxes
      const summaryY = 145
      const boxes = [
        { label: 'Bloqueados', value: blocked, color: '#EF4444' },
        { label: 'Em atenção', value: attention, color: '#F59E0B' },
        { label: 'Resolvidos', value: resolved, color: '#10B981' },
        { label: 'Total', value: impediments.length, color: BRAND_DARK },
      ]
      boxes.forEach((box, i) => {
        const x = 50 + i * 125
        doc.rect(x, summaryY, 115, 55).fillColor('#F9FAFB').fill()
        doc.fillColor(box.color).fontSize(28).font('Helvetica-Bold').text(String(box.value), x + 10, summaryY + 8)
        doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(box.label, x + 10, summaryY + 38)
      })

      // Table header
      const tableY = summaryY + 80
      doc.rect(50, tableY, 495, 22).fillColor('#F3F4F6').fill()
      doc.fillColor(BRAND_DARK).fontSize(8).font('Helvetica-Bold')
      doc.text('Descrição', 55, tableY + 7)
      doc.text('Tarefa', 215, tableY + 7)
      doc.text('Status', 345, tableY + 7)
      doc.text('Escalação', 410, tableY + 7)
      doc.text('Dias', 490, tableY + 7)

      // Table rows
      let rowY = tableY + 22
      doc.font('Helvetica').fontSize(8)

      for (const imp of impediments) {
        if (rowY > 770) {
          doc.addPage()
          rowY = 50
        }

        const bg = imp.status === ImpedimentStatus.BLOCKED
          ? '#FEF2F2'
          : imp.status === ImpedimentStatus.ATTENTION
            ? '#FFFBEB'
            : '#F0FDF4'

        doc.rect(50, rowY, 495, 20).fillColor(bg).fill()

        const days = Math.floor((Date.now() - imp.createdAt.getTime()) / 86_400_000)
        const statusLabel = imp.status === ImpedimentStatus.BLOCKED
          ? 'Bloqueado'
          : imp.status === ImpedimentStatus.ATTENTION
            ? 'Atenção'
            : 'Resolvido'

        doc.fillColor(BRAND_DARK)
        doc.text(imp.description.substring(0, 45), 55, rowY + 6, { width: 155, lineBreak: false })
        doc.text((imp.task?.title ?? '').substring(0, 35), 215, rowY + 6, { width: 125, lineBreak: false })
        doc.text(statusLabel, 345, rowY + 6, { width: 60, lineBreak: false })
        doc.text(`Nível ${imp.escalationLevel}`, 410, rowY + 6, { width: 75, lineBreak: false })
        doc.text(String(days), 490, rowY + 6, { width: 35, lineBreak: false })

        rowY += 20
      }

      if (impediments.length === 0) {
        doc.fillColor(GRAY).fontSize(11).font('Helvetica').text('Nenhum impedimento registrado.', 50, tableY + 35)
      }

      doc.end()
    })
  }

  async exportImpedimentsExcel(unitId: string): Promise<Buffer> {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId }, select: { name: true } })
    const impediments = await this.prisma.taskImpediment.findMany({
      where: { unitId },
      include: { task: { select: { title: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Mediall Brasil'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet('Impedimentos')

    // Title row
    sheet.mergeCells('A1:I1')
    sheet.getCell('A1').value = `Relatório de Impedimentos — ${unit?.name ?? unitId}`
    sheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FF1A2E3B' } }
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
    sheet.getRow(1).height = 28

    sheet.mergeCells('A2:I2')
    sheet.getCell('A2').value = `Gerado em: ${new Date().toLocaleString('pt-BR')}`
    sheet.getCell('A2').font = { size: 9, color: { argb: 'FF6B7280' } }

    // Headers
    const headerRow = sheet.getRow(4)
    const headers = ['Descrição', 'Tarefa', 'Status', 'Nível de Escalação', 'Responsável', 'Dias Aberto', 'Data Criação', 'Data Resolução', 'Notas de Resolução']
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h
      headerRow.getCell(i + 1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      headerRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2E3B' } }
      headerRow.getCell(i + 1).alignment = { vertical: 'middle', horizontal: 'center' }
    })
    headerRow.height = 22

    sheet.columns = [
      { key: 'desc', width: 40 },
      { key: 'task', width: 30 },
      { key: 'status', width: 14 },
      { key: 'level', width: 18 },
      { key: 'responsible', width: 20 },
      { key: 'days', width: 14 },
      { key: 'createdAt', width: 20 },
      { key: 'resolvedAt', width: 20 },
      { key: 'notes', width: 35 },
    ]

    const statusLabel = (s: string) => s === ImpedimentStatus.BLOCKED ? 'Bloqueado' : s === ImpedimentStatus.ATTENTION ? 'Atenção' : 'Resolvido'
    const escalationLabel = (l: number) => l === 0 ? 'Responsável' : l === 1 ? 'Gerência' : 'Diretoria'

    impediments.forEach((imp, idx) => {
      const days = Math.floor((Date.now() - imp.createdAt.getTime()) / 86_400_000)
      const row = sheet.getRow(5 + idx)

      row.getCell(1).value = imp.description
      row.getCell(2).value = imp.task?.title ?? ''
      row.getCell(3).value = statusLabel(imp.status)
      row.getCell(4).value = escalationLabel(imp.escalationLevel)
      row.getCell(5).value = imp.responsibleForResolution ?? ''
      row.getCell(6).value = days
      row.getCell(7).value = imp.createdAt.toLocaleDateString('pt-BR')
      row.getCell(8).value = imp.resolvedAt ? imp.resolvedAt.toLocaleDateString('pt-BR') : ''
      row.getCell(9).value = imp.resolutionNotes ?? ''

      const bgColor = imp.status === ImpedimentStatus.BLOCKED
        ? 'FFFEF2F2'
        : imp.status === ImpedimentStatus.ATTENTION
          ? 'FFFFFBEB'
          : 'FFF0FDF4'

      for (let c = 1; c <= 9; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        row.getCell(c).border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }
      }
      row.getCell(6).alignment = { horizontal: 'center' }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    return Buffer.from(buffer)
  }

  async exportDashboardPdf(userUnits: string[]): Promise<Buffer> {
    const unitFilter = userUnits.length > 0 ? { id: { in: userUnits } } : {}

    const [units, plans, impediments] = await Promise.all([
      this.prisma.unit.findMany({ where: { isActive: true, ...unitFilter }, select: { id: true, name: true } }),
      this.prisma.strategicPlan.findMany({
        where: { status: 'ACTIVE', ...(userUnits.length ? { unitId: { in: userUnits } } : {}) },
        include: { objectives: { select: { progressPct: true, trafficLight: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.taskImpediment.findMany({
        where: { status: { not: ImpedimentStatus.RESOLVED }, ...(userUnits.length ? { unitId: { in: userUnits } } : {}) },
        select: { unitId: true, escalationLevel: true, description: true, createdAt: true },
        orderBy: [{ escalationLevel: 'desc' }, { createdAt: 'asc' }],
        take: 20,
      }),
    ])

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' })
      const chunks: Buffer[] = []
      doc.on('data', (c: Buffer) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Header
      doc.fillColor(BRAND_DARK).fontSize(22).font('Helvetica-Bold').text('Mediall Brasil', 50, 50)
      doc.fillColor(GRAY).fontSize(11).font('Helvetica').text('Relatório Executivo', 50, 78)
      doc.fillColor(GRAY).fontSize(9).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 50, 95)
      doc.moveTo(50, 115).lineTo(545, 115).strokeColor(BRAND_GREEN).lineWidth(2).stroke()

      // Plans section
      let y = 130
      doc.fillColor(BRAND_DARK).fontSize(13).font('Helvetica-Bold').text('Planos Estratégicos Ativos', 50, y)
      y += 22

      for (const plan of plans) {
        if (y > 750) { doc.addPage(); y = 50 }
        const progress = plan.objectives.length
          ? Math.round(plan.objectives.reduce((s, o) => s + Number(o.progressPct), 0) / plan.objectives.length)
          : 0
        const hasRed = plan.objectives.some((o) => o.trafficLight === 'RED')
        const hasYellow = plan.objectives.some((o) => o.trafficLight === 'YELLOW')
        const light = hasRed ? '🔴' : hasYellow ? '🟡' : '🟢'
        const unit = units.find((u) => u.id === plan.unitId)

        doc.rect(50, y, 495, 30).fillColor('#F9FAFB').fill()
        doc.fillColor(BRAND_DARK).fontSize(10).font('Helvetica-Bold').text(`${light}  ${plan.name}`, 60, y + 8)
        doc.fillColor(GRAY).fontSize(9).font('Helvetica').text(`${unit?.name ?? ''} · ${progress}% concluído`, 60, y + 20)
        y += 36
      }

      if (plans.length === 0) {
        doc.fillColor(GRAY).fontSize(10).text('Nenhum plano ativo.', 50, y)
        y += 20
      }

      y += 10
      // Impediments section
      if (y > 650) { doc.addPage(); y = 50 }
      doc.fillColor(BRAND_DARK).fontSize(13).font('Helvetica-Bold').text('Impedimentos em Aberto', 50, y)
      y += 22

      if (impediments.length === 0) {
        doc.fillColor(GRAY).fontSize(10).font('Helvetica').text('Nenhum impedimento em aberto.', 50, y)
      } else {
        for (const imp of impediments) {
          if (y > 760) { doc.addPage(); y = 50 }
          const days = Math.floor((Date.now() - imp.createdAt.getTime()) / 86_400_000)
          const levelColor = imp.escalationLevel >= 2 ? '#EF4444' : imp.escalationLevel === 1 ? '#F59E0B' : GRAY
          doc.fillColor(levelColor).fontSize(8).font('Helvetica-Bold').text(`▶  Nível ${imp.escalationLevel}`, 55, y + 4)
          doc.fillColor(BRAND_DARK).fontSize(9).font('Helvetica').text(imp.description.substring(0, 80), 120, y + 4, { width: 380, lineBreak: false })
          doc.fillColor(GRAY).fontSize(8).text(`${days}d`, 500, y + 4)
          y += 18
        }
      }

      doc.end()
    })
  }
}
