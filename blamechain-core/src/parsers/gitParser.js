const simpleGit = require('simple-git');
const git = simpleGit();
const { printContributors, printDateRange } = require('../utils/format');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const { trackComplexityTrends } = require('../metrics/complexityAnalyzer');
const { fetchPRsByCommits, matchPRsByMessages } = require('./githubPRMatcher');

/**
 * Parse git stat output to extract insertions and deletions
 * @param {string} statOutput
 * @returns {Object}
 */
function parseStatOutput(statOutput) {
    const insertionMatch = statOutput.match(/(\d+) insertion/);
    const deletionMatch = statOutput.match(/(\d+) deletion/);
    return {
        insertions: insertionMatch ? parseInt(insertionMatch[1], 10) : 0,
        deletions: deletionMatch ? parseInt(deletionMatch[1], 10) : 0
    };
}

/**
 * @param {string} commitHash
 * @returns {Promise<Object>}
 */
async function getCommitStats(commitHash) {
    try {
        const { stdout } = await execAsync(`git show --stat ${commitHash}`);
        return parseStatOutput(stdout);
    } catch (error) {
        console.error(`Error getting stats for commit ${commitHash}: ${error.message}`);
        return { insertions: 0, deletions: 0 };
    }
}

/**
 * @returns {Promise<stringnull>}
 */
async function extractRepositoryInfo() {
    try {
        const remotes = await git.remote(['--verbose']);
        const remoteUrls = remotes.trim().split('\n');
        for (const line of remoteUrls) {
            const match = line.match(/github\.com[]([^/]+\/[^/]+)(?:\.git)?/);
            if (match && match[1]) return match[1];
        }
        console.warn('No GitHub repository found in git remotes.');
        return null;
    } catch (error) {
        console.error(`Error extracting repository info: ${error.message}`);
        return null;
    }
}

/**
 * Analyze history of a single file
 * @param {string} filePath
 * @returns {Promise<Objectnull>}
 */
async function analyzeFileHistory(filePath) {
    try {
        const log = await git.log({ file: filePath });
        if (isEmptyLog(log)) {
            console.log('No commit history found for this file.');
            return null;
        }

        displayCommitSummary(log);
        const authorMap = buildAuthorContributionMap(log.all);
        const commitsWithStats = await enrichCommitsWithChurnMetrics(log.all);
        const complexityData = await analyzeCodeComplexity(commitsWithStats);
        const pullRequests = await fetchAndLinkPullRequests(commitsWithStats);

        return buildAnalysisResults(commitsWithStats, authorMap, complexityData, pullRequests);
    } catch (err) {
        console.error('Error: Failed to retrieve git history.');
        console.error(err.message);
        return null;
    }
}

function isEmptyLog(log) {
    return !log || !log.all || log.all.length === 0;
}

function displayCommitSummary(log) {
    console.log(`Total commits: ${log.total}`);
    log.all.forEach(entry => {
        console.log(`${entry.date}  ${entry.author_name}  ${entry.message}`);
    });
}

function buildAuthorContributionMap(commits) {
    const authorMap = {};
    commits.forEach(entry => {
        authorMap[entry.author_name] = (authorMap[entry.author_name] || 0) + 1;
    });
    printContributors(authorMap);
    printDateRange(commits);
    return authorMap;
}

async function enrichCommitsWithChurnMetrics(commits) {
    const results = [];
    for (const entry of commits) {
        const stats = await getCommitStats(entry.hash);
        results.push({
            hash: entry.hash,
            date: entry.date,
            message: entry.message,
            author: entry.author_name,
            insertions: stats.insertions,
            deletions: stats.deletions,
            churn: stats.insertions + stats.deletions
        });
    }
    return results;
}

async function analyzeCodeComplexity(commitsWithStats) {
    console.log('Analyzing code complexity trends...');
    return trackComplexityTrends(commitsWithStats);
}

async function fetchAndLinkPullRequests(commitsWithStats) {
    console.log('Fetching Pull Request information...');
    const repo = await extractRepositoryInfo();
    if (!repo) {
        console.log('Skipping PR analysis - repository information not available.');
        return [];
    }

    const pullRequests = await fetchAllRelatedPullRequests(repo, commitsWithStats);
    linkPullRequestsToCommits(commitsWithStats, pullRequests);
    console.log(`Found ${pullRequests.length} related pull requests.`);
    return pullRequests;
}

async function fetchAllRelatedPullRequests(repo, commitsWithStats) {
    const byHash = await fetchPRsByCommits(repo, commitsWithStats);
    const byMessage = await matchPRsByMessages(repo, commitsWithStats);
    return deduplicatePullRequests([...byHash, ...byMessage]);
}

function deduplicatePullRequests(pullRequests) {
    const seen = new Map();
    pullRequests.forEach(pr => seen.set(pr.number, pr));
    return Array.from(seen.values());
}

function linkPullRequestsToCommits(commitsWithStats, pullRequests) {
    commitsWithStats.forEach(commit => {
        const matches = pullRequests.filter(pr =>
            pr.relatedCommits && pr.relatedCommits.includes(commit.hash)
        );
        if (matches.length) {
            commit.pullRequests = matches.map(pr => ({
                number: pr.number,
                title: pr.title,
                url: pr.url
            }));
        }
    });
}

function buildAnalysisResults(commitsWithStats, authorMap, complexityData, pullRequests) {
    return {
        commits: commitsWithStats,
        contributors: authorMap,
        complexity: complexityData,
        pullRequests
    };
}

module.exports = { analyzeFileHistory };