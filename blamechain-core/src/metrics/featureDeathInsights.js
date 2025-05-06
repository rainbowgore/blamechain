const fs = require('fs');

const FEATURE_DEATH_CONSTANTS = {
  DEFAULT_TODO_AGE_DAYS: 60,
  STALE_THRESHOLD_DAYS: 90,
  HIGH_RISK_THRESHOLD: 0.7
};

/**
 * Analyze TODOs to detect potential feature death
 * @param {Array} commits - Array of commit objects containing `files` and `date`
 * @param {Object} options - Configuration options
 * @returns {Object} Feature death analysis results
 */
function analyzeFeatureDeath(commits, options = {}) {
  const results = {};
  const now = Date.now();

  let todoResults;
  try {
    todoResults = JSON.parse(fs.readFileSync('output/data/todo-metrics.json', 'utf8'));
  } catch (error) {
    console.error('️ Failed to load TODO metrics:', error.message);
    return results;
  }

  Object.entries(todoResults || {}).forEach(([file, todos = []]) => {
    if (todos.length === 0) return;

    const todoAges = todos.map(todo => {
      const addedDate = new Date(todo.date || 0);
      return (now - addedDate.getTime()) / (1000 * 60 * 60 * 24); // days
    });

    const maxAge = Math.max(...todoAges);
    const avgAge = todoAges.reduce((sum, age) => sum + age, 0) / todoAges.length;
    const riskScore = Math.min(1, avgAge / FEATURE_DEATH_CONSTANTS.STALE_THRESHOLD_DAYS);

    results[file] = {
      todoCount: todos.length,
      averageAgeDays: Math.round(avgAge),
      maxAgeDays: Math.round(maxAge),
      isStale: maxAge >= FEATURE_DEATH_CONSTANTS.STALE_THRESHOLD_DAYS,
      riskScore,
      riskLevel:
        riskScore >= FEATURE_DEATH_CONSTANTS.HIGH_RISK_THRESHOLD
          ? 'high'
          : riskScore >= 0.4 ? 'medium' : 'low',
      todos
    };
  });

  return results;
}

/**
 * Generate a markdown report summarizing feature death risks
 * @param {Object} analysis - Output from analyzeFeatureDeath
 * @returns {string} Markdown report
 */
function generateFeatureDeathReport(analysis) {
  const lines = [
    '# Feature Death Report\n',
    'This report analyzes TODO comments and estimates risk of feature abandonment.\n',
    '## Summary\n',
    `- Total files scanned: ${Object.keys(analysis).length}`,
    `- High risk files: ${Object.values(analysis).filter(d => d.riskLevel === 'high').length}\n`
  ];

  for (const [file, data] of Object.entries(analysis)) {
    if (data.riskLevel !== 'high') continue;
    lines.push(`### ${file}`);
    lines.push(`- TODOs: ${data.todoCount}`);
    lines.push(`- Avg Age: ${data.averageAgeDays} days`);
    lines.push(`- Max Age: ${data.maxAgeDays} days`);
    lines.push(`- Risk Score: ${data.riskScore.toFixed(2)} (${data.riskLevel})\n`);
  }

  return lines.join('\n');
}

module.exports = {
  analyzeFeatureDeath,
  generateFeatureDeathReport,
  FEATURE_DEATH_CONSTANTS
};