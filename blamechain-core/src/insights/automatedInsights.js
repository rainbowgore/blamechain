const fs = require('fs');

const PRIORITY = {
  CRITICAL: 3,
  HIGH: 2,
  MEDIUM: 1,
  LOW: 0
};

const INSIGHTS_CONFIG = {
  THRESHOLDS: {
    HIGH_BURNOUT_RISK_THRESHOLD: 0.7,
    ABANDONED_FEATURE_THRESHOLD_DAYS: 60
  }
};

// Identify major issues
function identifyHighPriorityIssues({ burnoutData, featureDeathData }, config) {
  const issues = [];

  if (burnoutData?.riskScore > config.THRESHOLDS.HIGH_BURNOUT_RISK_THRESHOLD) {
    issues.push({
      id: 'burnout-risk',
      description: 'High burnout risk detected',
      priority: PRIORITY.CRITICAL
    });
  }

  if (featureDeathData?.abandonedFeatures > config.THRESHOLDS.ABANDONED_FEATURE_THRESHOLD_DAYS) {
    issues.push({
      id: 'abandoned-features',
      description: 'Abandoned features detected',
      priority: PRIORITY.HIGH
    });
  }

  return issues;
}

// Generate recommendations based on issues
function generateRecommendations(issues) {
  return issues.map(issue => {
    const urgency =
      issue.priority === PRIORITY.CRITICAL
        ? '(Critical priority – immediate action required)'
        : issue.priority === PRIORITY.HIGH
          ? '(High priority – address soon)'
          : '';
    return {
      issueId: issue.id,
      recommendation: `Address the issue: ${issue.description} ${urgency}`.trim()
    };
  });
}

// Turn recommendations into action items
function createActionItems(recommendations) {
  return recommendations.map((rec, index) => ({
    action: rec.recommendation,
    priority: index,
    source: rec.issueId,
    severity: 'high'
  }));
}

// Stubbed risk metrics – replace with real logic if needed
function calculateRiskMetrics() {
  return {
    overallRiskScore: 0.75,
    technicalDebtScore: 0.5,
    teamHealthScore: 0.8,
    maintenanceRiskScore: 0.6
  };
}

// Core entry point
function generateCombinedInsights({ ownershipData = {}, burnoutData = {}, featureDeathData = {} }, customConfig = {}) {
  const config = {
    ...INSIGHTS_CONFIG,
    ...customConfig,
    THRESHOLDS: {
      ...INSIGHTS_CONFIG.THRESHOLDS,
      ...(customConfig.THRESHOLDS || {})
    }
  };

  const issues = identifyHighPriorityIssues({ burnoutData, featureDeathData }, config);
  const recommendations = generateRecommendations(issues);
  const actionItems = createActionItems(recommendations);
  const riskMetrics = calculateRiskMetrics();

  return {
    highPriorityIssues: issues,
    recommendations,
    actionItems,
    riskMetrics,
    summary: {
      totalIssuesFound: issues.length,
      criticalIssuesCount: issues.filter(i => i.priority === PRIORITY.CRITICAL).length,
      highPriorityIssuesCount: issues.filter(i => i.priority === PRIORITY.HIGH).length,
      mediumPriorityIssuesCount: issues.filter(i => i.priority === PRIORITY.MEDIUM).length,
      lowPriorityIssuesCount: issues.filter(i => i.priority === PRIORITY.LOW).length
    }
  };
}

// Markdown output if needed
function generateInsightsReport(insights) {
  return `# Code Insights Report\n\nIssues Found: ${insights.summary.totalIssuesFound}`;
}

function writeInsightsReport(insights, outputPath) {
  const content = generateInsightsReport(insights);
  fs.writeFileSync(outputPath, content, 'utf8');
}

module.exports = {
  generateCombinedInsights,
  INSIGHTS_CONFIG,
  PRIORITY,
  identifyHighPriorityIssues,
  generateRecommendations,
  createActionItems,
  calculateRiskMetrics,
  generateInsightsReport,
  writeInsightsReport
};