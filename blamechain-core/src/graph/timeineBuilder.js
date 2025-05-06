function buildTimeline(commits) {
    const timeline = commits
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(commit => ({
            date: commit.date.split('T')[0],
            message: commit.message,
            author: commit.author_name
        }));

    return timeline;
}

module.exports = { buildTimeline };