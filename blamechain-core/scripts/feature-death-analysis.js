const FEATURE_DEATH_CONSTANTS = {
  DEFAULT_TODO_AGE_DAYS: 60,
  STALE_THRESHOLD_DAYS: 90,
  HIGH_RISK_THRESHOLD: 0.7
};

/**
 * Analyze TODOs to detect potential feature death
 * @param {Array} commits - Array of commit objects containing `files` and `date`
 * @param {Object} todoResults - Map of file -> TODO entries (from static scan)
 * @param {Object} options - Configuration options
 * @returns {Object} Feature death analysis results
 */
function analyzeFeatureDeath(commits, todoResults, options = {}) {
  const results = {};
  const now = Date.now();

  if (!todoResults || typeof todoResults !== 'object') {
    console.warn('Warning: todoResults is undefined or not an object. Returning empty results.');
    return results;
  }

  Object.keys(todoResults).forEach(file => {
    const todos = todoResults[file] || [];
    if (todos.length === 0) return;

    const todoAges = todos.map(todo => {
      const addedDate = new Date(todo.date || 0);
      const ageMs = now - addedDate.getTime();
      return ageMs / (1000 * 60 * 60 * 24); // days
    });

    const maxAge = Math.max(...todoAges);
    const avgAge = todoAges.reduce((sum, a) => sum + a, 0) / todoAges.length;

    const isStale = maxAge >= FEATURE_DEATH_CONSTANTS.STALE_THRESHOLD_DAYS;
    const riskScore = Math.min(1, avgAge / FEATURE_DEATH_CONSTANTS.STALE_THRESHOLD_DAYS);

    results[file] = {
      todoCount: todos.length,
      averageAgeDays: Math.round(avgAge),
      maxAgeDays: Math.round(maxAge),
      isStale,
      riskScore,
      riskLevel:
        riskScore >= FEATURE_DEATH_CONSTANTS.HIGH_RISK_THRESHOLD
          ? 'high'
          : riskScore >= 0.4
            ? 'medium'
            : 'low',
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
  const lines = [];
  lines.push(`# Feature Death Report\n`);
  lines.push(`This report analyzes TODO comments and estimates risk of feature abandonment.\n`);
  lines.push(`## Summary\n`);
  lines.push(`- Total files scanned: ${Object.keys(analysis).length}`);
  const highRisk = Object.entries(analysis).filter(([_, d]) => d.riskLevel === 'high');
  lines.push(`- High risk files: ${highRisk.length}\n`);

  if (highRisk.length > 0) {
    lines.push(`## High Risk Areas\n`);
    highRisk.forEach(([file, data]) => {
      lines.push(`### ${file}`);
      lines.push(`- TODOs: ${data.todoCount}`);
      lines.push(`- Avg Age: ${data.averageAgeDays} days`);
      lines.push(`- Max Age: ${data.maxAgeDays} days`);
      lines.push(`- Risk Score: ${data.riskScore.toFixed(2)} (${data.riskLevel})\n`);
    });
  }

  return lines.join('\n');
}

module.exports = {
  analyzeFeatureDeath,
  generateFeatureDeathReport,
  FEATURE_DEATH_CONSTANTS
};