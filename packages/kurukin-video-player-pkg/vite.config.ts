import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Genera las definiciones de TypeScript para tus otros proyectos
    dts({ include: ['src/kurukin-video-player'] })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/kurukin-video-player/index.ts'),
      name: 'KurukinVideoPlayer',
      formats: ['es', 'umd'],
      fileName: (format) => `kurukin-video-player.${format}.js`,
      cssFileName: 'style',
    },
    rollupOptions: {
      // Excluimos React del paquete final para que no pese el doble
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
        // Forzamos a que el CSS final se llame style.css
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'style.css';
          return assetInfo.name || 'asset';
        },
      },
    },
  },
});
