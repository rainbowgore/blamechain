const { execSync } = require('child_process');

function extractNumber(text, pattern) {
  const match = text.match(pattern);
  return match ? parseInt(match[1], 10) : 0;
}

function getCommitCount(repoPath) {
  try {
    return parseInt(
      execSync(`git -C "${repoPath}" rev-list --count HEAD`, { encoding: 'utf8' }).trim()
    );
  } catch {
    return 0;
  }
}

function getAuthors(repoPath) {
  try {
    return execSync(`git -C "${repoPath}" log --format="%an" | sort -u`, {
      encoding: 'utf8'
    }).trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getCommitDates(repoPath) {
  try {
    const first = execSync(`git -C "${repoPath}" log --format="%aI" --reverse | head -1`, {
      encoding: 'utf8'
    }).trim();

    const last = execSync(`git -C "${repoPath}" log --format="%aI" -n 1`, {
      encoding: 'utf8'
    }).trim();

    return {
      firstCommitDate: first || null,
      lastCommitDate: last || null
    };
  } catch {
    return { firstCommitDate: null, lastCommitDate: null };
  }
}

function getChurnMetrics(repoPath) {
  try {
    const stats = execSync(
      `git -C "${repoPath}" diff --shortstat $(git -C "${repoPath}" rev-list --max-parents=0 HEAD) HEAD`,
      { encoding: 'utf8' }
    ).trim();

    const insertions = extractNumber(stats, /(\d+) insertion/);
    const deletions = extractNumber(stats, /(\d+) deletion/);

    return {
      insertions,
      deletions,
      totalChurn: insertions + deletions
    };
  } catch {
    return { insertions: 0, deletions: 0, totalChurn: 0 };
  }
}

function getTopContributor(repoPath) {
  try {
    const stats = execSync(`git -C "${repoPath}" shortlog -s -n HEAD | head -1`, {
      encoding: 'utf8'
    }).trim();

    return stats.replace(/^\s*\d+\s*/, '') || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function extractRepoStats(repoPath) {
  try {
    const commitCount = getCommitCount(repoPath);
    const authors = getAuthors(repoPath);
    const dates = getCommitDates(repoPath);
    const churn = getChurnMetrics(repoPath);
    const topContributor = getTopContributor(repoPath);

    return {
      commitCount,
      authorCount: authors.length,
      firstCommitDate: dates.firstCommitDate,
      lastCommitDate: dates.lastCommitDate,
      ...churn,
      topContributor
    };
  } catch {
    return null;
  }
}

module.exports = {
  extractRepoStats,
  getCommitCount,
  getAuthors,
  getCommitDates,
  getChurnMetrics,
  getTopContributor
};