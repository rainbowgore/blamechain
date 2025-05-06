function getCommitStats(commits) {
    if (!commits || commits.length === 0) {
        return {
            totalCommits: 0,
            totalContributors: 0,
            contributorStats: [],
            averageCommitsPerContributor: 'N/A',
            averageLinesPerCommit: 'N/A',
            topContributor: 'N/A'
        };
    }

    const contributorMap = {};
    let totalLines = 0;

    commits.forEach(commit => {
        const author = commit.author || 'unknown';
        contributorMap[author] = (contributorMap[author] || 0) + 1;
        totalLines += (commit.insertions || 0) + (commit.deletions || 0);
    });

    const totalCommits = commits.length;
    const contributorStats = Object.entries(contributorMap).map(([author, count]) => ({
        author,
        count,
        percent: `${((count / totalCommits) * 100).toFixed(1)}%`
    }));

    const totalContributors = contributorStats.length;
    const averageCommitsPerContributor = (totalCommits / totalContributors).toFixed(2);
    const averageLinesPerCommit = (totalLines / totalCommits).toFixed(2);
    const topContributor = contributorStats.reduce((top, curr) =>
        curr.count > top.count ? curr : top, contributorStats[0]);

    return {
        totalCommits,
        totalContributors,
        contributorStats,
        averageCommitsPerContributor,
        averageLinesPerCommit,
        topContributor: topContributor?.author || 'N/A'
    };
}

module.exports = { getCommitStats };