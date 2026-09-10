const createApp = require('./app');
const { createClient } = require('./redis');

const PORT = process.env.PORT || 3001;
const redis = createClient();

redis.on('error', (err) => console.error('Redis error:', err.message));

const app = createApp(redis);
app.listen(PORT, () => {
  console.log(`utility-hub listening on port ${PORT}`);
});
