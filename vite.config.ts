import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // 상대 경로로 빌드 — GitHub Pages 하위 경로(/rootlessvoicing/)와 로컬 preview 양쪽에서 그대로 뜬다.
  // 라우터가 없는 단일 페이지라 이걸로 충분하다.
  base: './',
  plugins: [react(), tailwindcss()],
})
