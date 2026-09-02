import { Module } from '@nestjs/common';
import { AIPort } from '../../domain/ports/ai.port';
import { AnthropicAdapter } from '../../infrastructure/ai/anthropic.adapter';
import { OpenRouterAdapter } from '../../infrastructure/ai/openrouter.adapter';
import { EnvService } from '../env/env.service';

@Module({
  providers: [
    {
      provide: AIPort,
      inject: [EnvService],
      useFactory: (env: EnvService) => {
        const provider = env.get('AI_PROVIDER');
        const apiKey = env.get('AI_API_KEY');
        const model = env.get('AI_MODEL');
        if (provider === 'openrouter')
          return new OpenRouterAdapter(apiKey, model);
        return new AnthropicAdapter(apiKey, model);
      },
    },
  ],
  exports: [AIPort],
})
export class AIModule {}
