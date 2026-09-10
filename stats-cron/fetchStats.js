// Fetches public repo stats from the GitHub API. No auth required for public
// repos (rate-limited to 60 req/hr unauthenticated, plenty for a periodic job).
async function fetchRepoStats(repo, fetchImpl = fetch) {
  const res = await fetchImpl(`https://api.github.com/repos/${repo}`, {
    headers: { 'User-Agent': 'stats-cron', Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) {
    throw new Error(`GitHub API returned ${res.status} for ${repo}`);
  }
  const data = await res.json();
  return {
    repo,
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    fetchedAt: new Date().toISOString(),
  };
}

module.exports = { fetchRepoStats };
