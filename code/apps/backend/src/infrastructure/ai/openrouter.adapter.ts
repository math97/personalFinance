import { Injectable } from '@nestjs/common'
import OpenAI from 'openai'
import { AIPort, ExtractedTransaction } from '../../domain/ports/ai.port'

@Injectable()
export class OpenRouterAdapter extends AIPort {
  private readonly client: OpenAI
  private readonly model: string

  constructor() {
    super()
    const apiKey = process.env.AI_API_KEY
    if (!apiKey) throw new Error('Missing API key: set AI_API_KEY for the openrouter provider')
    this.model = process.env.AI_MODEL ?? 'anthropic/claude-haiku-4-5'
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://personal-finance-app',
        'X-Title': 'Personal Finance',
      },
    })
  }

  async extractTransactions(buffer: Buffer, mediaType: string): Promise<ExtractedTransaction[]> {
    const base64 = buffer.toString('base64')
    const isPdf = mediaType === 'application/pdf'
    const dataUri = `data:${mediaType};base64,${base64}`

    // OpenRouter uses a custom "file" content type for PDFs (not image_url)
    // and standard image_url for images. Both are outside the OpenAI SDK types,
    // so we cast to any to bypass type checking.
    const userContent: any[] = isPdf
      ? [
          { type: 'text', text: 'Extract all transactions from this bank statement.' },
          { type: 'file', file: { filename: 'statement.pdf', file_data: dataUri } },
        ]
      : [{ type: 'image_url', image_url: { url: dataUri } }]

    const response = await (this.client.chat.completions.create as any)({
      model: this.model,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: this.extractionPrompt },
        { role: 'user', content: userContent },
      ],
      // Use OpenRouter's file-parser plugin for better PDF text extraction
      ...(isPdf && { plugins: [{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }] }),
    })

    return this.parseResponse(response.choices[0]?.message?.content ?? '')
  }

  async suggestCategory(description: string, categoryNames: string[]): Promise<string | null> {
    if (categoryNames.length === 0) return null

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 64,
      messages: [
        { role: 'system', content: this.categorizationSystem(categoryNames) },
        { role: 'user', content: description },
      ],
    })

    const text = (response.choices[0]?.message?.content ?? '').trim()
    return categoryNames.includes(text) ? text : null
  }
}
