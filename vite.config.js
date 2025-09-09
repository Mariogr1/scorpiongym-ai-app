import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga las variables de entorno desde .env, .env.local, etc.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Expone la variable de entorno correcta al cliente.
      // Busca GEMINI_API_KEY del archivo .env del usuario y la mapea a
      // process.env.API_KEY, que es lo que el código de la aplicación espera.
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    }
  }
})