const request = require('supertest');
const createApp = require('../app');
const { createClient } = require('../redis');

describe('utility-hub', () => {
  let app, redis;

  beforeAll(async () => {
    redis = createClient();
    app = createApp(redis);
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.flushdb();
  });

  test('GET /health reports ok when redis is reachable', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /metrics exposes prometheus metrics', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
  });

  test('POST /api/shorten rejects missing url', async () => {
    const res = await request(app).post('/api/shorten').send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/shorten rejects an invalid url', async () => {
    const res = await request(app).post('/api/shorten').send({ url: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  test('POST /api/shorten creates a short code, and the redirect works', async () => {
    const create = await request(app)
      .post('/api/shorten')
      .send({ url: 'https://example.com/some/long/path' });
    expect(create.status).toBe(201);
    expect(create.body.code).toHaveLength(7);
    expect(create.body.shortUrl).toContain(create.body.code);

    const redirect = await request(app).get(`/${create.body.code}`);
    expect(redirect.status).toBe(302);
    expect(redirect.headers.location).toBe('https://example.com/some/long/path');
  });

  test('GET /:code on unknown code returns 404', async () => {
    const res = await request(app).get('/doesnotexist');
    expect(res.status).toBe(404);
  });

  test('GET /api/stats/:code tracks click count', async () => {
    const create = await request(app)
      .post('/api/shorten')
      .send({ url: 'https://example.com' });
    const code = create.body.code;

    await request(app).get(`/${code}`);
    await request(app).get(`/${code}`);

    const stats = await request(app).get(`/api/stats/${code}`);
    expect(stats.status).toBe(200);
    expect(stats.body.clicks).toBe(2);
  });

  test('GET /api/digest returns 404 when no digest has been written yet', async () => {
    const res = await request(app).get('/api/digest');
    expect(res.status).toBe(404);
  });

  test('GET /api/digest returns the latest digest once written', async () => {
    await redis.set('digest:latest', JSON.stringify({ repo: 'x/y', stars: 5, fetchedAt: '2026-01-01T00:00:00Z' }));
    const res = await request(app).get('/api/digest');
    expect(res.status).toBe(200);
    expect(res.body.stars).toBe(5);
  });
});
