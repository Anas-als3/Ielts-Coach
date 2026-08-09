import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
  },
  test: {
    /*
     * Two projects, because the two suites want different worlds.
     *
     * `engine` is the analysis and storage suite: pure functions, Node, no DOM.
     * Keeping it in Node is not just speed — it means nothing in the engine can
     * quietly start depending on a browser global.
     *
     * `ui` is the component suite: jsdom, Testing Library, and a setup file
     * that clears storage between tests.
     */
    projects: [
      {
        extends: true,
        test: {
          name: 'engine',
          environment: 'node',
          include: ['tests/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['tests/ui/*.test.tsx'],
          setupFiles: ['tests/ui/setup.ts'],
        },
      },
    ],
  },
})
