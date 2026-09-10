const { createClient } = require('./redis');
const { fetchRepoStats } = require('./fetchStats');

const REPO = process.env.DIGEST_REPO || 'arjitmenon9/todo-app';

async function main() {
  const redis = createClient();
  try {
    console.log(`Fetching stats for ${REPO}...`);
    const digest = await fetchRepoStats(REPO);
    await redis.set('digest:latest', JSON.stringify(digest));
    console.log('Digest written:', digest);
    return digest;
  } finally {
    await redis.quit();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('stats-cron failed:', err);
    process.exit(1);
  });
}

module.exports = { main };
