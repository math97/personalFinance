import { Injectable } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'

export interface ExtractedTransaction {
  date: string
  description: string
  amount: number
}

@Injectable()
export class ClaudeService {
  private readonly client = new Anthropic()

  parseResponse(text: string): ExtractedTransaction[] {
    if (!text.trim()) return []
    try {
      const parsed = JSON.parse(text)
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (item): item is ExtractedTransaction =>
          typeof item.date === 'string' &&
          typeof item.description === 'string' &&
          typeof item.amount === 'number',
      )
    } catch {
      return []
    }
  }

  async extractTransactions(fileBuffer: Buffer, mediaType: string): Promise<ExtractedTransaction[]> {
    const base64 = fileBuffer.toString('base64')
    const isPdf = mediaType === 'application/pdf'

    const prompt = `Extract all transactions from this bank statement or receipt.
Return ONLY a valid JSON array. No other text, no markdown, no explanation.
Format: [{"date":"YYYY-MM-DD","description":"merchant name","amount":-12.50}]
Rules:
- amount is negative for expenses/debits, positive for credits/income
- Use full year in date (if year unclear use ${new Date().getFullYear()})
- Return [] if no transactions found`

    const message = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: [
            isPdf
              ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } }
              : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 } },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    return this.parseResponse(text)
  }

  async suggestCategory(description: string, categoryNames: string[]): Promise<string | null> {
    if (categoryNames.length === 0) return null

    const message = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      system: `You categorize financial transactions. Given a description, return the best matching category name from the list, or "none" if none fits. Return ONLY the category name or "none". No other text.
Categories: ${categoryNames.join(', ')}`,
      messages: [{ role: 'user', content: description }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : 'none'
    return categoryNames.includes(text) ? text : null
  }
}
