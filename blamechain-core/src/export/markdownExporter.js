const fs = require('fs');
const path = require('path');

const HIGH_CHURN_THRESHOLD = 500;
const HIGH_AVG_CHURN_THRESHOLD = 50;
const MAX_SIGNIFICANT_CHANGES = 5;
const STALE_PR_DAYS = 30;
const MAX_PRS_TO_DISPLAY = 10;

function generateBasicStats(stats) {
    let content = `## Stats\n`;
    content += `- Total commits: ${stats?.totalCommits || 0}\n`;
    content += `- Total contributors: ${stats?.totalContributors || 0}\n`;
    content += `- Avg commits per contributor: ${stats?.averageCommitsPerContributor || 'N/A'}\n`;
    content += `- Avg lines per commit: ${stats?.averageLinesPerCommit || 'N/A'}\n\n`;
    return content;
}

function calculateChurnMetrics(timeline) {
    let totalInsertions = 0;
    let totalDeletions = 0;
    
    timeline.forEach(commit => {
        totalInsertions += commit.insertions || 0;
        totalDeletions += commit.deletions || 0;
    });
    
    const totalChurn = totalInsertions + totalDeletions;
    const insertionDeletionRatio = totalDeletions > 0 ? (totalInsertions / totalDeletions).toFixed(2) : 'N/A';
    const avgChurnPerCommit = timeline.length > 0 ? (totalChurn / timeline.length).toFixed(2) : 0;
    
    return {
        totalInsertions,
        totalDeletions,
        totalChurn,
        insertionDeletionRatio,
        avgChurnPerCommit
    };
}

function generateChurnMetricsSection(timeline) {
    let content = `## Code Churn Metrics\n`;
    
    if (timeline.length === 0) {
        content += `No churn metrics available.\n\n`;
        return content;
    }
    
    const metrics = calculateChurnMetrics(timeline);
    
    content += `- Total insertions: ${metrics.totalInsertions}\n`;
    content += `- Total deletions: ${metrics.totalDeletions}\n`;
    content += `- Total churn (insertions + deletions): ${metrics.totalChurn}\n`;
    content += `- Insertion to deletion ratio: ${metrics.insertionDeletionRatio}\n`;
    content += `- Average churn per commit: ${metrics.avgChurnPerCommit}\n\n`;
    
    return content;
}
function generateContributorsSection(stats) {
    let content = `## Contributors\n`;
    if (Array.isArray(stats?.contributorStats) && stats.contributorStats.length > 0) {
        stats.contributorStats.forEach(stat => {
            content += `- ${stat.author}: ${stat.count} commits (${stat.percent})\n`;
        });
    } else {
        content += `No contributor stats available.\n`;
    }
    return content;
}

function generateTodosSection(todos) {
    let content = `\n## TODOs\n`;
    if (todos.length === 0) {
        content += `No TODOs found.\n`;
    } else {
        todos.forEach(t => {
            content += `- [${t.file}] ${t.text}\n`;
        });
    }
    return content;
}

function formatChurnInfo(commit) {
    if (commit.insertions === undefined || commit.deletions === undefined) {
        return '';
    }
    
    const insertions = commit.insertions || 0;
    const deletions = commit.deletions || 0;
    const churn = commit.churn || (insertions + deletions);
    
    return ` [+${insertions}/-${deletions}, churn: ${churn}]`;
}

function formatPRLink(commit) {
    if (!commit.pullRequests || commit.pullRequests.length === 0) {
        return '';
    }
    
    const prLinks = commit.pullRequests.map(pr => {
        return `[PR #${pr.number}](${pr.url})`;
    }).join(', ');
    
    return ` (${prLinks})`;
}

function generateTimelineSection(timeline) {
    let content = `\n## Timeline\n`;
    if (timeline.length === 0) {
        content += `No commit timeline available.\n`;
    } else {
        timeline.forEach(commit => {
            const prLink = formatPRLink(commit);
            const churnInfo = formatChurnInfo(commit);
            content += `- ${commit.date}: ${commit.author} - ${commit.message}${prLink}${churnInfo}\n`;
        });
    }
    return content;
}
function isHighChurnFile(chain) {
    return chain.totalChurn > HIGH_CHURN_THRESHOLD  
           (chain.avgChurnPerCommit && parseFloat(chain.avgChurnPerCommit) > HIGH_AVG_CHURN_THRESHOLD);
}

function formatFileChurnMetrics(chain) {
    let content = '';
    
    if (chain.totalInsertions !== undefined && chain.totalDeletions !== undefined && chain.totalChurn !== undefined) {
        content += `  Churn: +${chain.totalInsertions || 0}/-${chain.totalDeletions || 0} (total: ${chain.totalChurn || 0})\n`;
        content += `  Avg churn per commit: ${chain.avgChurnPerCommit || 'N/A'}\n`;
        
        if (isHighChurnFile(chain)) {
            content += `  [HIGH CHURN FILE] - Consider reviewing for refactoring opportunities\n`;
        }
    }
    
    return content;
}

function generateEvolutionSection(evolution) {
    let content = `\n## File Evolution Chains\n`;
    if (evolution.length === 0) {
        content += `No evolution data available.\n`;
    } else {
        evolution.forEach(chain => {
            content += `- ${chain.files.join(' -> ')}\n`;
            content += `  Authors: ${[...new Set(chain.authors)].join(', ')}\n`;
            content += formatFileChurnMetrics(chain);
            content += `\n`;
        });
    }
    return content;
}

function formatComplexityTrend(trend) {
    const currentComplexity = trend.complexityHistory[trend.complexityHistory.length - 1].complexity;
    const initialComplexity = trend.complexityHistory[0].complexity;
    
    let content = `- **${trend.file}::${trend.function}**\n`;
    content += `  - Complexity growth rate: ${trend.complexityGrowthRate.toFixed(2)} per commit\n`;
    content += `  - Current complexity: ${currentComplexity}\n`;
    content += `  - Initial complexity: ${initialComplexity}\n\n`;
    
    return content;
}

function formatComplexityChange(change) {
    let content = `- **${change.file}::${change.function}**\n`;
    content += `  - Commit: ${change.commitHash.substring(0, 7)} by ${change.author}\n`;
    content += `  - Date: ${change.date}\n`;
    content += `  - Complexity change: +${change.complexityIncrease} (from ${change.beforeComplexity} to ${change.afterComplexity})\n`;
    
    const lineChangePrefix = change.lineCountChange > 0 ? '+' : '';
    content += `  - Line count change: ${lineChangePrefix}${change.lineCountChange}\n\n`;
    
    return content;
}

function generateComplexitySection(complexity) {
    let content = `\n## Code Complexity Analysis\n`;
    
    if (!complexity || (!complexity.complexityTrends || complexity.complexityTrends.length === 0)) {
        content += `No complexity metrics available.\n`;
        return content;
    }
    
    const refactoringCandidates = complexity.complexityTrends.filter(trend => trend.needsRefactoring);
    const increasingComplexity = complexity.complexityTrends.filter(trend => trend.increasingTrend);
    
    content += `### Summary\n`;
    content += `- Functions analyzed: ${complexity.complexityChanges?.length || 0}\n`;
    content += `- Functions with increasing complexity: ${increasingComplexity.length}\n`;
    content += `- Refactoring candidates: ${refactoringCandidates.length}\n\n`;
    
    if (refactoringCandidates.length > 0) {
        content += `### [REFACTORING CANDIDATES]\n`;
        content += `These functions show significant complexity growth and should be considered for refactoring:\n\n`;
        
        refactoringCandidates.forEach(candidate => {
            content += formatComplexityTrend(candidate);
        });
    }
    
    if (increasingComplexity.length > 0 && increasingComplexity.length !== refactoringCandidates.length) {
        content += `### Functions with Increasing Complexity\n`;
        content += `These functions are showing a trend of increasing complexity:\n\n`;
        
        increasingComplexity
            .filter(trend => !trend.needsRefactoring)
            .forEach(trend => {
                content += formatComplexityTrend(trend);
            });
    }
    
    const significantChanges = complexity.complexityChanges
        .filter(change => change.isSignificantIncrease)
        .slice(0, MAX_SIGNIFICANT_CHANGES);
    
    if (significantChanges.length > 0) {
        content += `### Recent Significant Complexity Increases\n`;
        content += `These functions recently had significant complexity increases:\n\n`;
        
        significantChanges.forEach(change => {
            content += formatComplexityChange(change);
        });
    }
    
    return content;
}

function formatPRMetrics(pr) {
    let content = `- **PR #${pr.number}**: [${pr.title}](${pr.url})\n`;
    content += `  - Author: ${pr.author}\n`;
    content += `  - Created: ${new Date(pr.createdAt).toISOString().split('T')[0]}\n`;
    
    if (pr.mergedAt) {
        content += `  - Merged: ${new Date(pr.mergedAt).toISOString().split('T')[0]}\n`;
    } else if (pr.state === 'closed') {
        content += `  - Status: Closed (not merged)\n`;
    } else {
        content += `  - Status: Open\n`;
    }
    
    content += `  - Reviewers: ${pr.reviewerCount}\n`;
    
    if (pr.reviewers && pr.reviewers.length > 0) {
        content += `  - Reviewed by: ${pr.reviewers.join(', ')}\n`;
    }
    
    if (pr.firstApprovalDays !== null) {
        content += `  - Time to first approval: ${pr.firstApprovalDays.toFixed(1)} days\n`;
    }
    
    if (pr.isStale) {
        content += `  - [STALE PR] This PR has been open for more than ${STALE_PR_DAYS} days\n`;
    }
    
    content += `\n`;
    return content;
}

function calculatePRMetrics(pullRequests) {
    if (!pullRequests || pullRequests.length === 0) {
        return {
            totalPRs: 0,
            openPRs: 0,
            mergedPRs: 0,
            closedPRs: 0,
            stalePRs: 0,
            avgReviewerCount: 0,
            avgApprovalTime: 0
        };
    }
    
    const openPRs = pullRequests.filter(pr => pr.state === 'open').length;
    const mergedPRs = pullRequests.filter(pr => pr.mergedAt).length;
    const closedPRs = pullRequests.filter(pr => pr.state === 'closed' && !pr.mergedAt).length;
    const stalePRs = pullRequests.filter(pr => pr.isStale).length;
    
    const totalReviewers = pullRequests.reduce((sum, pr) => sum + (pr.reviewerCount || 0), 0);
    const avgReviewerCount = pullRequests.length > 0 ? (totalReviewers / pullRequests.length).toFixed(1) : 0;
    
    const prsWithApprovalTimes = pullRequests.filter(pr => pr.firstApprovalDays !== null);
    const totalApprovalTime = prsWithApprovalTimes.reduce((sum, pr) => sum + pr.firstApprovalDays, 0);
    const avgApprovalTime = prsWithApprovalTimes.length > 0 ? 
        (totalApprovalTime / prsWithApprovalTimes.length).toFixed(1) : 'N/A';
    
    return {
        totalPRs: pullRequests.length,
        openPRs,
        mergedPRs,
        closedPRs,
        stalePRs,
        avgReviewerCount,
        avgApprovalTime
    };
}

function generatePRAnalysisSection(pullRequests) {
    let content = `\n## Pull Request Analysis\n`;
    
    if (!pullRequests || pullRequests.length === 0) {
        content += `No pull request data available.\n`;
        return content;
    }
    
    const metrics = calculatePRMetrics(pullRequests);
    
    content += `### Summary\n`;
    content += `- Total PRs: ${metrics.totalPRs}\n`;
    content += `- Open PRs: ${metrics.openPRs}\n`;
    content += `- Merged PRs: ${metrics.mergedPRs}\n`;
    content += `- Closed PRs (not merged): ${metrics.closedPRs}\n`;
    content += `- Stale PRs (open > ${STALE_PR_DAYS} days): ${metrics.stalePRs}\n`;
    content += `- Average reviewers per PR: ${metrics.avgReviewerCount}\n`;
    content += `- Average time to first approval: ${metrics.avgApprovalTime} days\n\n`;
    
    if (metrics.stalePRs > 0) {
        content += `### [STALE PRs]\n`;
        content += `These PRs have been open for more than ${STALE_PR_DAYS} days and need attention:\n\n`;
        
        pullRequests
            .filter(pr => pr.isStale)
            .forEach(pr => {
                content += formatPRMetrics(pr);
            });
    }
    
    content += `### Recent Pull Requests\n`;
    
    const sortedPRs = [...pullRequests].sort((a, b) => {
        const dateA = a.mergedAt || a.createdAt;
        const dateB = b.mergedAt || b.createdAt;
        return new Date(dateB) - new Date(dateA);
    });
    
    const recentPRs = sortedPRs.slice(0, MAX_PRS_TO_DISPLAY);
    
    recentPRs.forEach(pr => {
        content += formatPRMetrics(pr);
    });
    
    return content;
}

function exportMarkdownSummary({ stats, contributors = [], todos = [], timeline = [], evolution = [], complexity = {}, pullRequests = [] }) {
    let content = `# Blamechain Summary Report\n\n`;
    
    content += generateBasicStats(stats);
    content += generateChurnMetricsSection(timeline);
    content += generateContributorsSection(stats);
    content += generatePRAnalysisSection(pullRequests);
    content += generateTodosSection(todos);
    content += generateTimelineSection(timeline);
    content += generateEvolutionSection(evolution);
    content += generateComplexitySection(complexity);

    const outputPath = path.join(process.cwd(), 'summary.md');
    fs.writeFileSync(outputPath, content);
    console.log(`\nsummary.md written to: ${outputPath}`);
}

module.exports = { exportMarkdownSummary };