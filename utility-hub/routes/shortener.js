const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');

module.exports = function (redis) {
  // Create a short URL
  router.post('/api/shorten', express.json(), async (req, res, next) => {
    try {
      const { url } = req.body || {};
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'url is required' });
      }
      try {
        new URL(url); // throws if invalid
      } catch {
        return res.status(400).json({ error: 'url must be a valid absolute URL' });
      }

      const code = nanoid(7);
      await redis.set(`url:${code}`, url);
      await redis.set(`url:${code}:clicks`, 0);

      res.status(201).json({
        code,
        url,
        shortUrl: `${req.protocol}://${req.get('host')}/${code}`,
      });
    } catch (err) { next(err); }
  });

  // Stats for a short code
  router.get('/api/stats/:code', async (req, res, next) => {
    try {
      const url = await redis.get(`url:${req.params.code}`);
      if (!url) return res.status(404).json({ error: 'not found' });
      const clicks = Number((await redis.get(`url:${req.params.code}:clicks`)) || 0);
      res.json({ code: req.params.code, url, clicks });
    } catch (err) { next(err); }
  });

  // Redirect a short code to its original URL
  router.get('/:code', async (req, res, next) => {
    try {
      // Don't swallow known app routes as "codes"
      if (['api', 'health', 'metrics'].includes(req.params.code)) return next();

      const url = await redis.get(`url:${req.params.code}`);
      if (!url) return res.status(404).send('Not found');
      await redis.incr(`url:${req.params.code}:clicks`);
      res.redirect(url);
    } catch (err) { next(err); }
  });

  return router;
};
