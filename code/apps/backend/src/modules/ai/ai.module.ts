import { Module } from '@nestjs/common'
import { AIPort } from '../../domain/ports/ai.port'
import { AnthropicAdapter } from '../../infrastructure/ai/anthropic.adapter'
import { OpenRouterAdapter } from '../../infrastructure/ai/openrouter.adapter'

@Module({
  providers: [
    {
      provide: AIPort,
      useFactory: () => {
        const provider = process.env.AI_PROVIDER ?? 'anthropic'
        if (provider === 'openrouter') return new OpenRouterAdapter()
        return new AnthropicAdapter()
      },
    },
  ],
  exports: [AIPort],
})
export class AIModule {}
