import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  envDir: false,
  envPrefix: [],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom', 'three'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'viem',
      'viem/chains',
      'lucide-react',
      'three',
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/rapier',
      'zustand',
    ],
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Keep the 3D engine out of the app chunk so game code edits cache well.
        manualChunks(id) {
          if (id.includes('@dimforge/rapier3d')) return 'rapier'
          if (id.includes('/three/') || id.includes('@react-three')) return 'three'
        },
      },
    },
  },
  server: {
    allowedHosts: ['.studio.arc.io', '.studio-staging.arc.io'],
  },
})
