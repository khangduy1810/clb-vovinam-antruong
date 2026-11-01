import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({base:process.env.VITE_BASE_PATH||'./',server:{allowedHosts:['terminal.local']},plugins:[react(),tailwindcss()],build:{outDir:'dist'}});
