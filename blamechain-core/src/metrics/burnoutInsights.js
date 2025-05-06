// burnoutInsights.js

// Constants for burnout thresholds and default config
const BURNOUT_CONSTANTS = {
  MIN_COMMITS_FOR_ANALYSIS: 5,
  HIGH_RISK_THRESHOLD: 0.6,
  MEDIUM_RISK_THRESHOLD: 0.3
};

// Dummy burnout analysis logic
function analyzeBurnoutRisk(commits, options) {
  const authors = {};
  for (const commit of commits) {
    const author = commit.author;
    if (!authors[author]) authors[author] = { count: 0 };
    authors[author].count += 1;
  }

  const insights = {
    teamInsights: {
      totalAuthors: Object.keys(authors).length,
      analyzedAuthors: Object.values(authors).filter(a => a.count >= options.constants.MIN_COMMITS_FOR_ANALYSIS).length,
      highRiskAuthors: 1,
      mediumRiskAuthors: 1,
      lowRiskAuthors: 1,
      offHoursPercentage: 0.25,
      weekendPercentage: 0.3,
      topPatterns: [
        { type: 'high-off-hours', count: 3, percentage: 75 }
      ]
    },
    recommendations: [
      {
        description: 'Set healthier commit hour expectations',
        actions: ['Use time-aware PR guidelines']
      }
    ],
    authorInsights: {
      'john@example.com': {
        burnoutRiskScore: 0.75,
        concerningPatterns: [{ description: 'Mostly commits at 2 AM' }]
      }
    }
  };

  return {
    insights,
    highRiskAuthors: ['john@example.com'],
    mediumRiskAuthors: ['jane@example.com'],
    lowRiskAuthors: ['alex@example.com']
  };
}

// Dummy markdown generator
function generateBurnoutReport(analysis) {
  return `# Burnout Risk Report

**High Risk Contributors:**  
- ${analysis.highRiskAuthors.join('\n- ')}

**Insights Summary:**  
Contributors analyzed: ${analysis.insights.teamInsights.analyzedAuthors}
Total contributors: ${analysis.insights.teamInsights.totalAuthors}
`;
}

module.exports = {
  analyzeBurnoutRisk,
  generateBurnoutReport,
  BURNOUT_CONSTANTS
};