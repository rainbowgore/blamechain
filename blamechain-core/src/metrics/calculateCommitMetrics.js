function calculateCommitMetrics(commits) {
    const contributorStats = {};
    let totalLinesChanged = 0;

    commits.forEach(commit => {
        const author = commit.author_name || 'Unknown';
        contributorStats[author] = contributorStats[author] || { commits: 0, lines: 0 };
        contributorStats[author].commits += 1;
        if (commit.stats && commit.stats.total) {
            contributorStats[author].lines += commit.stats.total;
            totalLinesChanged += commit.stats.total;
        }
    });

    const averageCommits = commits.length / Object.keys(contributorStats).length;

    return {
        contributorStats,
        averageCommits,
        totalLinesChanged,
    };
}

module.exports = { calculateCommitMetrics };