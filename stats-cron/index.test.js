jest.mock('./fetchStats', () => ({
  fetchRepoStats: jest.fn().mockResolvedValue({
    repo: 'test/repo',
    stars: 42,
    forks: 7,
    openIssues: 2,
    fetchedAt: '2026-01-01T00:00:00.000Z',
  }),
}));

const { createClient } = require('./redis');
const { main } = require('./index');

test('main() writes the digest to redis', async () => {
  const redis = createClient();
  await redis.flushdb();

  const digest = await main();
  expect(digest.stars).toBe(42);

  const raw = await redis.get('digest:latest');
  expect(raw).not.toBeNull();
  expect(JSON.parse(raw).stars).toBe(42);

  await redis.quit();
});
