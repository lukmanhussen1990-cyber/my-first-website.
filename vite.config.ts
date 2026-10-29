import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `vite build` → regular multi-file build in dist/.
// `vite build --mode single` → one JS bundle with every asset inlined, which
// scripts/inline-html.mjs folds into a single self-contained HTML file.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    // Relative base so builds work from any sub-path (e.g. GitHub Pages) or the file system.
    base: './',
    plugins: [react()],
    build: single
      ? {
          target: 'es2022',
          outDir: 'dist-single',
          assetsInlineLimit: 100_000_000,
          cssCodeSplit: false,
          modulePreload: false,
          chunkSizeWarningLimit: 4000,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : {
          target: 'es2022',
          chunkSizeWarningLimit: 1400,
          rollupOptions: {
            output: {
              manualChunks: {
                three: ['three'],
                r3f: ['@react-three/fiber', '@react-three/drei'],
                postprocessing: ['postprocessing'],
              },
            },
          },
        },
  };
});
