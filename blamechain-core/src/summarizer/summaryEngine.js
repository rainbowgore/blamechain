function getCommitStats(commits) {
    if (!commits || commits.length === 0) return null;

    const contributorMap = {};
    let totalLines = 0;

    commits.forEach(commit => {
        const author = commit.author || 'unknown';
        contributorMap[author] = (contributorMap[author] || 0) + 1;

        const linesChanged = (commit.insertions || 0) + (commit.deletions || 0);
        totalLines += linesChanged;
    });

    const contributors = Object.keys(contributorMap);
    const totalCommits = commits.length;
    const averageCommitsPerContributor = (totalCommits / contributors.length).toFixed(2);
    const averageLinesPerCommit = (totalLines / totalCommits).toFixed(2);

    const contributorStats = contributors.map(author => {
        const count = contributorMap[author];
        const percent = ((count / totalCommits) * 100).toFixed(1) + '%';
        return { author, count, percent };
    });

    return {
        totalCommits,
        totalContributors: contributors.length,
        averageCommitsPerContributor,
        averageLinesPerCommit,
        contributorStats
    };
}

module.exports = { getCommitStats };