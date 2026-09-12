import './loadEnv.js';
import app from './app.js';

const PORT = process.env.BACKEND_PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`[TaniCo Express Backend] Server running on http://127.0.0.1:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[TaniCo Express Backend] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('[TaniCo Express Backend] Closed out remaining connections.');
    process.exit(0);
  });
});

export default server;
