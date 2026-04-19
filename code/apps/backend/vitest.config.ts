import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/tests/**/*.spec.ts'],
    setupFiles: ['src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/tests/**', 'src/generated/**', 'src/main.ts'],
    },
  },
  plugins: [
    // SWC handles emitDecoratorMetadata for NestJS decorators
    swc.vite({ module: { type: 'es6' } }),
  ],
})
