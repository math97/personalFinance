import { Injectable } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { AIPort, ExtractedTransaction } from '../../domain/ports/ai.port'

@Injectable()
export class AnthropicAdapter extends AIPort {
  private readonly client: Anthropic

  constructor() {
    super()
    this.client = new Anthropic({
      apiKey: process.env.AI_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    })
  }

  async extractTransactions(buffer: Buffer, mediaType: string): Promise<ExtractedTransaction[]> {
    const base64 = buffer.toString('base64')
    const isPdf = mediaType === 'application/pdf'

    const message = await this.client.messages.create({
      model: process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: this.extractionPrompt,
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
      model: process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      system: this.categorizationSystem(categoryNames),
      messages: [{ role: 'user', content: description }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : 'none'
    return categoryNames.includes(text) ? text : null
  }
}
