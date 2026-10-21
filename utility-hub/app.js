const path = require('path');
const express = require('express');
const pinoHttp = require('pino-http');
const client = require('prom-client');
const shortenerRoutes = require('./routes/shortener');
const digestRoutes = require('./routes/digest');

const metricsRegistry = new client.Registry();
client.collectDefaultMetrics({ register: metricsRegistry });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [metricsRegistry],
});

// Simple permissive CORS — this is a public demo suite, nothing sensitive,
// and the portfolio static site needs to call these endpoints cross-origin
// from the browser, including a JSON POST to /api/shorten. A POST with a
// Content-Type header triggers a CORS preflight (OPTIONS) request, so this
// also answers that preflight directly instead of only handling the
// simple GET case.
function cors(req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
}

function createApp(redis) {
  const app = express();
  app.use(pinoHttp({ enabled: process.env.NODE_ENV !== 'test' }));
  app.use(cors);

  app.use((req, res, next) => {
    res.on('finish', () => {
      const route = (req.route && req.route.path) || req.path;
      httpRequestCounter.inc({ method: req.method, route, status: res.statusCode });
    });
    next();
  });

  app.get('/health', async (req, res) => {
    try {
      await redis.ping();
      res.json({ status: 'ok', redis: 'connected' });
    } catch (err) {
      res.status(503).json({ status: 'degraded', redis: 'unreachable' });
    }
  });

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  });

  // Serves public/index.html at GET / — a small page with a form for
  // POST /api/shorten, so the shortener can be used without curl/terminal.
  // express.static serves index.html for the directory root automatically
  // and 404s (falls through, below) for anything else under public/.
  app.use(express.static(path.join(__dirname, 'public')));

  app.use(digestRoutes(redis));
  app.use(shortenerRoutes(redis));

  app.use((req, res) => res.status(404).json({ error: 'not found' }));

  app.use((err, req, res, next) => {
    if (req.log) req.log.error(err); else console.error(err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

module.exports = createApp;
