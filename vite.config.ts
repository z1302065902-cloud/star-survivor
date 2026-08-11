import { defineConfig } from 'vite'

// 部署在 GitHub Pages 子路径 /star-survivor/
export default defineConfig({
  base: '/star-survivor/',
  build: {
    outDir: 'dist',
  },
})
