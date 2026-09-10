const Redis = require('ioredis');

function createClient() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const opts = {};
  if (process.env.REDIS_TLS === 'true') {
    opts.tls = { rejectUnauthorized: false };
  }
  return new Redis(url, opts);
}

module.exports = { createClient };
