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

// Simple permissive CORS for GET endpoints — this is a public demo suite,
// nothing sensitive, and the portfolio static site needs to fetch these
// cross-origin from the browser.
function cors(req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
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
