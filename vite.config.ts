import tailwindcss from '@tailwindcss/vite';
import react        from '@vitejs/plugin-react';
import path         from 'path';
import { defineConfig } from 'vite';

// Fix: CRIT-02 — REMOVED the `define` block that was embedding
// VITE_ANTHROPIC_KEY into the client bundle.
// The Anthropic API key must ONLY exist in:
//   - Netlify environment variables (server-side, in netlify/functions/claude.ts)
//   - Local .env.local (never committed to git)
// It must NEVER be prefixed with VITE_ or included in the frontend bundle.

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    // Warn if any chunk exceeds 600kb (helps catch accidental bundle bloat)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split vendor libraries for better caching
        manualChunks: {
          'react-vendor':    ['react', 'react-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'chart-vendor':    ['recharts'],
          'motion-vendor':   ['motion'],
        },
      },
    },
  },
});
