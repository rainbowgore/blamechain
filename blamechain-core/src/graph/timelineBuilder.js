function aggregateCommitsByPeriod(commits, getPeriodStart, getPeriodEnd, periodType) {
  if (!commits || commits.length === 0) {
    return [];
  }

  const sortedCommits = [...commits].sort((a, b) => new Date(a.date) - new Date(b.date));
  const periodMap = {};

  sortedCommits.forEach(commit => {
    const commitDate = new Date(commit.date);
    const periodStart = getPeriodStart(commitDate);
    const periodEnd = getPeriodEnd(commitDate);
    const periodKey = createPeriodKey(periodStart, periodEnd);

    if (!periodMap[periodKey]) {
      periodMap[periodKey] = {
        periodType,
        startDate: periodStart,
        endDate: periodEnd,
        displayRange: DateUtils.formatDateRange(periodStart, periodEnd),
        commits: [],
        commitCount: 0,
        authors: {},
        insertions: 0,
        deletions: 0,
        churn: 0,
        prs: new Set()
      };
    }

    const period = periodMap[periodKey];
    period.commits.push(commit);
    period.commitCount++;

    const author = commit.author || 'unknown';
    period.authors[author] = (period.authors[author] || 0) + 1;

    period.insertions += commit.insertions || 0;
    period.deletions += commit.deletions || 0;
    period.churn += commit.churn((commit.insertions || 0) + (commit.deletions || 0));

  if (commit.pr) {
    period.prs.add(commit.pr.number);
  }
  if (commit.related_prs && Array.isArray(commit.related_prs)) {
    commit.related_prs.forEach(pr => {
      if (pr.number) {
        period.prs.add(pr.number);
      }
    });
  }
});

return Object.values(periodMap)
  .map(period => ({
    ...period,
    authorList: Object.entries(period.authors).map(([name, count]) => ({ name, count })),
    prNumbers: Array.from(period.prs)
  }))
  .sort((a, b) => a.startDate - b.startDate);
}

function buildCustomTimeline(commits = [], days = 14) {
  if (!commits || commits.length === 0 || days <= 0) {
    return [];
  }

  const getCustomPeriodStart = (date) => {
    const d = new Date(date);
    const timestamp = d.getTime();
    const dayInMs = 24 * 60 * 60 * 1000;
    const periodInMs = days * dayInMs;

    const firstCommitDate = new Date(Math.min(...commits.map(c => new Date(c.date).getTime())));
    const firstPeriodStart = new Date(firstCommitDate);
    firstPeriodStart.setHours(0, 0, 0, 0);

    const msSinceFirst = timestamp - firstPeriodStart.getTime();
    const periodsElapsed = Math.floor(msSinceFirst / periodInMs);

    return new Date(firstPeriodStart.getTime() + (periodsElapsed * periodInMs));
  };

  const getCustomPeriodEnd = (date) => {
    const periodStart = getCustomPeriodStart(date);
    return new Date(periodStart.getTime() + (days * 24 * 60 * 60 * 1000) - 1);
  };

  return aggregateCommitsByPeriod(
    commits,
    getCustomPeriodStart,
    getCustomPeriodEnd,
    `${days}-day period`
  );
}