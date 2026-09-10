const { fetchRepoStats } = require('../fetchStats');

describe('fetchRepoStats', () => {
  test('parses a successful GitHub API response', async () => {
    const fakeFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stargazers_count: 3,
        forks_count: 1,
        open_issues_count: 0,
      }),
    });

    const result = await fetchRepoStats('someone/repo', fakeFetch);
    expect(result.repo).toBe('someone/repo');
    expect(result.stars).toBe(3);
    expect(result.forks).toBe(1);
    expect(result.openIssues).toBe(0);
    expect(new Date(result.fetchedAt).toString()).not.toBe('Invalid Date');
  });

  test('throws when the GitHub API errors', async () => {
    const fakeFetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchRepoStats('missing/repo', fakeFetch)).rejects.toThrow('404');
  });
});
