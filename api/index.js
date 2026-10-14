import { createApp } from '../server/src/app.js';

const app = createApp();

export default function handler(req, res) {
  // Ensure the path retains the /api prefix expected by express routes
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
}
