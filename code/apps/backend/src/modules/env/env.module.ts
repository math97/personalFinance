import { Global, Module } from '@nestjs/common';
import { EnvSchema } from './env.schema';
import { EnvService } from './env.service';

@Global()
@Module({
  providers: [
    {
      provide: EnvService,
      useFactory: () => {
        const parsed = EnvSchema.safeParse(process.env);
        if (!parsed.success) {
          console.error(
            'Invalid environment variables:\n',
            parsed.error.format(),
          );
          process.exit(1);
        }
        return new EnvService(parsed.data);
      },
    },
  ],
  exports: [EnvService],
})
export class EnvModule {}
