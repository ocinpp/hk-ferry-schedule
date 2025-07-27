import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    proxy: {
      '/api/ferry-schedule': {
        target: 'https://www.sunferry.com.hk',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ferry-schedule/, '/eta/timetable/SunFerry_central_muiwo_timetable_eng.csv')
      },
      '/api/holidays': {
        target: 'https://www.1823.gov.hk',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/holidays/, '/common/ical/en.json')
      }
    }
  }
})