import { fileURLToPath, URL } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';

const appVersion = readFileSync('./VERSION', 'utf-8').trim();

// NOTE: this proxy block only applies to LOCAL DEV (`npm run dev`). In a Launcher
// install the WEB frontend is served by nginx, which proxies these paths to each
// service (the Launcher owns ports and lets the user reassign any that are taken).
// Here we mirror that: every upstream port is read from .env with the current
// default as fallback, so no port is hardcoded and dev follows whatever ports the
// user/Launcher chose. CLI_PORT matches the name the Launcher prompts for.
export default defineConfig(({ mode }) => {
  // Empty prefix => load non-VITE_ vars too (these are not VITE_ vars).
  const env = loadEnv(mode, process.cwd(), '');
  const port = (name: string, fallback: string) => env[name] || fallback;

  const backendPort = port('WEB_BACKEND_PORT', '3001'); // Express/Prisma backend
  const cliPort = port('CLI_PORT', '8000');             // CLI API (Launcher: CLI_PORT)
  const krApiPort = port('KR_API_PORT', '8004');        // Kiterunner API
  const krMcpPort = port('KR_MCP_PORT', '8003');        // Kiterunner MCP

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url))
      }
    },
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/cli-api': {
          target: `http://localhost:${cliPort}`,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/cli-api/, ''),
        },
        '/health': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/kr-api': {
          target: `http://localhost:${krApiPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/kr-api/, ''),
        },
        '/kr-mcp': {
          target: `http://localhost:${krMcpPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/kr-mcp/, ''),
        },
      },
    },
  };
});
