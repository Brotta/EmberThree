import { defineConfig } from 'vite';

export default defineConfig({
  base: '/EmberThree/',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
});
