const { outputSummary } = require('../utils/output');
const { buildCommitGraph } = require('../graph/commitGraphBuilder');
const { renderGraph } = require('../graph/renderGraph');
const { buildTimeline } = require('../graph/timelineBuilder');
const { exportGraphJSON, exportGraphPNG } = require('../graph/graphExporter');
const { exportMarkdownSummary } = require('../export/markdownExporter');
const { getCommitStats } = require('../metrics/commitStats');
const { trackFileEvolution } = require('../graph/GraphBuilder');

function generateSummary({ commits, contributors = [], todos, pullRequests = [], complexity = {} }, options = {}) {
    outputSummary({ commits, contributors, todos }, options);

    const graph = buildCommitGraph(commits);
    renderGraph(graph);

    const timeline = buildTimeline(commits);
    displayTimelineInConsole(timeline, pullRequests);

    const evolution = trackFileEvolution(commits);

    if (options.export) {
        const stats = getCommitStats(commits) || createDefaultStatsObject();
        exportGraphsAndSummary(graph, stats, contributors, todos, timeline, evolution, complexity);
    }
}

function displayTimelineInConsole(timeline, pullRequests) {
    console.log('\nTimeline:');
    timeline.forEach(commit => {
        const pullRequestLink = findPullRequestLink(commit, pullRequests);
        const churnMetrics = formatChurnMetrics(commit);
        console.log(`${commit.date}: ${commit.author} - ${commit.message}${pullRequestLink}${churnMetrics}`);
    });
}

function findPullRequestLink(commit, pullRequests) {
    const matchingPR = pullRequests.find(pr => pr.message?.includes(commit.message));
    return matchingPR ? ` → PR #${matchingPR.number} (${matchingPR.url})` : '';
}

function formatChurnMetrics(commit) {
    const hasChurnData = commit.insertions !== undefined && commit.deletions !== undefined;

    if (!hasChurnData) {
        return '';
    }

    const insertions = commit.insertions || 0;
    const deletions = commit.deletions || 0;
    const churn = commit.churn(insertions + deletions);

    return ` [+${insertions}/-${deletions}, churn: ${churn}]`;
}

function createDefaultStatsObject() {
    return {
        totalCommits: 0,
        totalContributors: 0,
        averageCommitsPerContributor: 'N/A',
        averageLinesPerCommit: 'N/A',
        contributorStats: []
    };
}

function exportGraphsAndSummary(graph, stats, contributors, todos, timeline, evolution, complexity) {
    exportGraphJSON(graph);
    exportGraphPNG(graph);

    exportMarkdownSummary({
        stats,
        contributors,
        todos,
        timeline,
        evolution,
        complexity
    });
}

module.exports = { generateSummary };