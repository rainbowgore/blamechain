/**
 * Repository comparison report generation functions
 */

/**
 * Generate a basic comparison table in Markdown
 * @param {Array} repoStats - Array of repository statistics objects
 * @returns {string} Markdown table
 */
function generateComparisonTable(repoStats) {
  const lines = [
    '## Basic Statistics',
    '',
    ' Repository  Commits  Contributors  Lines Added  Lines Removed  Total Churn  Top Contributor ',
    '---------------------------------------------------------------------------------------------'
  ];
  
  // Add a row for each repository
  repoStats.forEach(repo => {
    lines.push(
      ` ${repo.name}  ${repo.stats.commitCount}  ${repo.stats.authorCount}  ` + 
      `${repo.stats.insertions}  ${repo.stats.deletions}  ${repo.stats.totalChurn}  ` + 
      `${repo.stats.topContributor} `
    );
  });
  
  return lines.join('\n');
}

/**
 * Rank repositories based on a specific metric
 * @param {Array} repoStats - Array of repository statistics objects
 * @param {string} metricKey - Key of the metric to rank by
 * @param {boolean} highToLow - Sort from high to low (true) or low to high (false)
 * @returns {Array} Ranked repositories
 */
function rankRepositories(repoStats, metricKey, highToLow = true) {
  return [...repoStats]
    .sort((a, b) => {
      const valA = a.stats[metricKey] || 0;
      const valB = b.stats[metricKey] || 0;
      return highToLow ? valB - valA : valA - valB;
    })
    .map((repo, index) => ({
      rank: index + 1,
      name: repo.name,
      value: repo.stats[metricKey] || 0
    }));
}

/**
 * Generate a ranking section in Markdown
 * @param {Array} rankings - Array of ranked repositories
 * @param {string} title - Title for the ranking section
 * @param {string} metric - Name of the metric
 * @param {string} unit - Unit for the metric (optional)
 * @returns {string} Markdown ranking section
 */
function generateRankingSection(rankings, title, metric, unit = '') {
  const lines = [
    `### ${title}`,
    '',
    ` Rank  Repository  ${metric} `,
    '------------------------------'
  ];
  
  // Add a row for each repository
  rankings.forEach(repo => {
    lines.push(` ${repo.rank}  ${repo.name}  ${repo.value}${unit} `);
  });
  
  return lines.join('\n');
}

/**
 * Generate a list of key findings
 * @param {Array} repoStats - Array of repository statistics objects
 * @returns {string} Markdown list of key findings
 */
function generateKeyFindings(repoStats) {
  const lines = [
    '## Key Findings',
    ''
  ];
  
  // Most commits
  const commitRanking = rankRepositories(repoStats, 'commitCount');
  if (commitRanking.length > 0) {
    const mostActive = commitRanking[0];
    lines.push(`- **${mostActive.name}** has the most activity with ${mostActive.value} commits`);
  }
  
  // Most code churn
  const churnRanking = rankRepositories(repoStats, 'totalChurn');
  if (churnRanking.length > 0) {
    const highestChurn = churnRanking[0];
    lines.push(`- **${highestChurn.name}** has the highest code churn with ${highestChurn.value} lines changed`);
  }
  
  // Most contributors
  const contributorRanking = rankRepositories(repoStats, 'authorCount');
  if (contributorRanking.length > 0) {
    const mostContributors = contributorRanking[0];
    lines.push(`- **${mostContributors.name}** has the most contributors with ${mostContributors.value} different authors`);
  }
  
  return lines.join('\n');
}

/**
 * Generate a full comparison report in Markdown
 * @param {Array} repoStats - Array of repository statistics objects
 * @returns {string} Complete Markdown report
 */
function generateFullReport(repoStats) {
  // Title and date
  const lines = [
    '# Repository Comparison Report',
    `*Generated on ${new Date().toISOString().split('T')[0]}*`,
    '',
    'This report compares statistics across multiple Git repositories.',
    ''
  ];
  
  // Add the comparison table
  lines.push(generateComparisonTable(repoStats));
  lines.push('');
  
  // Add ranking sections
  lines.push('## Rankings', '');
  
  // Commit count ranking
  const commitRanking = rankRepositories(repoStats, 'commitCount');
  lines.push(generateRankingSection(commitRanking, 'Most Active Repositories', 'Commit Count'));
  lines.push('');
  
  // Churn ranking
  const churnRanking = rankRepositories(repoStats, 'totalChurn');
  lines.push(generateRankingSection(churnRanking, 'Highest Churn Repositories', 'Lines Changed'));
  lines.push('');
  
  // Contributor ranking
  const contributorRanking = rankRepositories(repoStats, 'authorCount');
  lines.push(generateRankingSection(contributorRanking, 'Most Contributors', 'Contributor Count'));
  lines.push('');
  
  // Add key findings
  lines.push(generateKeyFindings(repoStats));
  lines.push('');
  
  return lines.join('\n');
}

module.exports = {
  generateComparisonTable,
  rankRepositories,
  generateRankingSection,
  generateKeyFindings,
  generateFullReport
};
