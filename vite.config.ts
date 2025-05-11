import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Allow importing from the parent library
      '../../src': path.resolve(__dirname, '../src'),
      // Allow importing the components
      'components': path.resolve(__dirname, '../components'),
    },
  },
  server: {
    port: 3000,
  },
}); 