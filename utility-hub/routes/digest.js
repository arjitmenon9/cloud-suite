const express = require('express');
const router = express.Router();

module.exports = function (redis) {
  // Latest digest written by the stats-cron job.
  router.get('/api/digest', async (req, res, next) => {
    try {
      const raw = await redis.get('digest:latest');
      if (!raw) return res.status(404).json({ error: 'no digest yet' });
      res.json(JSON.parse(raw));
    } catch (err) { next(err); }
  });

  return router;
};
