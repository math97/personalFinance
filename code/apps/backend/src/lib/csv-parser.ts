import { Injectable, BadRequestException } from '@nestjs/common'
import { ExtractedTransaction } from '../domain/ports/ai.port'

@Injectable()
export class CsvParser {
  parse(buffer: Buffer): ExtractedTransaction[] {
    const text = buffer.toString('utf-8')
    const lines = text.split(/\r?\n/)
    const nonEmpty = lines.filter(l => l.trim() !== '')

    if (nonEmpty.length === 0) {
      throw new BadRequestException('CSV file is empty')
    }

    const header = nonEmpty[0].toLowerCase().trim()
    if (header !== 'date,description,amount') {
      throw new BadRequestException(
        'Invalid CSV format. Expected header: date,description,amount',
      )
    }

    const dataLines = nonEmpty.slice(1)
    if (dataLines.length === 0) {
      throw new BadRequestException('CSV file contains no valid transactions')
    }

    const results: ExtractedTransaction[] = []

    for (const line of dataLines) {
      const parts = line.split(',')
      if (parts.length < 3) continue

      const rawDate = parts[0].trim()
      const description = parts.slice(1, parts.length - 1).join(',').trim()
      const rawAmount = parts[parts.length - 1].trim()

      const date = this.parseDate(rawDate)
      if (!date) continue

      const amount = Number(rawAmount)
      if (isNaN(amount)) continue

      results.push({ date, description, amount })
    }

    if (results.length === 0) {
      throw new BadRequestException('CSV file contains no valid transactions')
    }

    return results
  }

  private parseDate(raw: string): string | null {
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      const d = new Date(raw)
      if (isNaN(d.getTime())) return null
      return raw
    }
    // DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
      const [day, month, year] = raw.split('/')
      const iso = `${year}-${month}-${day}`
      const d = new Date(iso)
      if (isNaN(d.getTime())) return null
      return iso
    }
    return null
  }
}
