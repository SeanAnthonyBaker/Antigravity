import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fetchNotebookLMQuiz } from './src/utils/notebooklmQuizFetcher'

function notebooklmQuizPlugin() {
  return {
    name: 'notebooklm-quiz-proxy',
    configureServer(server: any) {
      server.middlewares.use('/api/fetch-notebooklm-quiz', async (req: any, res: any) => {
        try {
          const urlObj = new URL(req.url, 'http://localhost');
          let targetUrl = urlObj.searchParams.get('url') || '';

          if (!targetUrl && req.method === 'POST') {
            let body = '';
            for await (const chunk of req) {
              body += chunk;
            }
            try {
              const parsed = JSON.parse(body);
              targetUrl = parsed.url || '';
            } catch {}
          }

          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Missing url parameter' }));
            return;
          }

          console.log('[Vite:NotebookLM-Proxy] Fetching quiz from:', targetUrl);
          const result = await fetchNotebookLMQuiz(targetUrl);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, ...result }));
        } catch (err: any) {
          console.error('[Vite:NotebookLM-Proxy] Error fetching quiz:', err.message);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err.message || 'Failed to fetch NotebookLM quiz' }));
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_BASE_URL || 'http://localhost:5000'

  return {
    plugins: [react(), notebooklmQuizPlugin()],
    server: {
      proxy: {
        '/xai-api': {
          target: 'https://api.x.ai/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/xai-api/, ''),
        },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})

