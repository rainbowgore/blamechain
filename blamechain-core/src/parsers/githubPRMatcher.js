const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Time constants in milliseconds for clarity
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CACHE_TTL_MS = ONE_DAY_IN_MS; // 1 day
const DEFAULT_API_RETRY_DELAY_MS = 1000; // 1 second
const STALE_PR_THRESHOLD_DAYS = 30;
const STALE_PR_THRESHOLD_MS = STALE_PR_THRESHOLD_DAYS * ONE_DAY_IN_MS;

const config = {
    token: process.env.GITHUB_TOKEN,
    baseUrl: 'https://api.github.com',
    cacheDir: process.env.CACHE_DIR || './.cache',
    cacheTTL: parseInt((process.env.CACHE_TTL || DEFAULT_CACHE_TTL_MS.toString()), 10),
    retryDelay: parseInt((process.env.RETRY_DELAY || DEFAULT_API_RETRY_DELAY_MS.toString()), 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    prMessageRegex: /(?:#\d+|pull request #\d+|pr #\d+|pull\/\d+)/i
};

const prCache = new Map();

function ensureCacheDirectory() {
    if (!fs.existsSync(config.cacheDir)) {
        fs.mkdirSync(config.cacheDir, { recursive: true });
    }
}

function getCacheFilePath(repo) {
    ensureCacheDirectory();
    return path.join(config.cacheDir, `${repo.replace('/', '_')}_pr_cache.json`);
}

function loadCacheFromDisk(repo) {
    const cacheFilePath = getCacheFilePath(repo);

    if (fs.existsSync(cacheFilePath)) {
        try {
            const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));

            if (cacheData && cacheData.timestamp && (Date.now() - cacheData.timestamp < config.cacheTTL)) {
                Object.entries(cacheData.prs || {}).forEach(([key, value]) => {
                    prCache.set(key, value);
                });
                return true;
            }
        } catch (error) {
            console.error(`Error loading PR cache for ${repo}: ${error.message}`);
        }
    }

    return false;
}

function saveCacheToDisk(repo) {
    const cacheFilePath = getCacheFilePath(repo);

    try {
        const cacheData = {
            timestamp: Date.now(),
            prs: Object.fromEntries(prCache)
        };

        fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2));
    } catch (error) {
        console.error(`Error saving PR cache for ${repo}: ${error.message}`);
    }
}

function extractPRNumbers(message) {
    const matches = message.match(config.prMessageRegex);
    if (!matches) {
        return [];
    }

    return matches.map(match => {
        const numberMatch = match.match(/\d+/);
        return numberMatch ? parseInt(numberMatch[0], 10) : null;
    }).filter(Boolean);
}

function buildAuthHeaders() {
    if (!config.token) {
        return { Accept: 'application/vnd.github.v3+json' };
    }

    return {
        Authorization: `token ${config.token}`,
        Accept: 'application/vnd.github.v3+json'
    };
}

async function fetchWithRetry(url, options, retryCount = 0) {
    try {
        return await axios.get(url, options);
    } catch (error) {
        if (error.response && error.response.status === 403 &&
            error.response.headers['x-ratelimit-remaining'] === '0') {

            const resetTime = parseInt(error.response.headers['x-ratelimit-reset'], 10) * 1000;
            const waitTime = Math.max(0, resetTime - Date.now());

            console.log(`Rate limit exceeded. Waiting ${Math.ceil(waitTime / 1000)} seconds before retrying...`);

            await new Promise(resolve => setTimeout(resolve, waitTime));
            return fetchWithRetry(url, options, retryCount);
        }

        if (retryCount < config.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, config.retryDelay));
            return fetchWithRetry(url, options, retryCount + 1);
        }

        throw error;
    }
}

async function fetchPRDetails(repo, prNumber) {
    const cacheKey = `${repo}-pr-${prNumber}`;

    if (prCache.has(cacheKey)) {
        return prCache.get(cacheKey);
    }

    const headers = buildAuthHeaders();

    try {
        const [prRes, reviewsRes] = await Promise.all([
            fetchWithRetry(`${config.baseUrl}/repos/${repo}/pulls/${prNumber}`, { headers }),
            fetchWithRetry(`${config.baseUrl}/repos/${repo}/pulls/${prNumber}/reviews`, { headers })
        ]);

        const pr = prRes.data;
        const reviews = reviewsRes.data;

        const approvalDates = reviews
            .filter(review => review.state === 'APPROVED')
            .map(review => new Date(review.submitted_at));

        const prCreatedDate = new Date(pr.created_at);

        const uniqueReviewers = [...new Set(reviews.map(review => review.user.login))];

        let firstApprovalDuration = null;
        if (approvalDates.length > 0) {
            const firstApproval = new Date(Math.min(...approvalDates));
            firstApprovalDuration = (firstApproval - prCreatedDate) / (1000 * 60 * 60 * 24); // in days
        }

        const prDetails = {
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            author: pr.user.login,
            createdAt: pr.created_at,
            mergedAt: pr.merged_at,
            state: pr.state,
            reviewerCount: uniqueReviewers.length,
            reviewers: uniqueReviewers,
            approvalCount: approvalDates.length,
            firstApprovalDays: firstApprovalDuration,
            isStale: pr.state === 'open' && new Date() - prCreatedDate > STALE_PR_THRESHOLD_MS,
            relatedCommits: []
        };

        prCache.set(cacheKey, prDetails);
        return prDetails;
    } catch (error) {
        console.error(`Error fetching details for PR #${prNumber} in ${repo}: ${error.message}`);
        return null;
    }
}

async function fetchPRsFromCommitHash(repo, commitHash) {
    const cacheKey = `${repo}-commit-${commitHash}`;

    if (prCache.has(cacheKey)) {
        return prCache.get(cacheKey);
    }

    const headers = buildAuthHeaders();

    try {
        const response = await fetchWithRetry(
            `${config.baseUrl}/repos/${repo}/commits/${commitHash}/pulls`,
            { headers }
        );

        const prs = response.data.map(pr => ({
            number: pr.number,
            title: pr.title,
            url: pr.html_url
        }));

        prCache.set(cacheKey, prs);
        return prs;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            prCache.set(cacheKey, []);
            return [];
        }

        console.error(`Error fetching PRs for commit ${commitHash} in ${repo}: ${error.message}`);
        return [];
    }
}

async function fetchPRsByCommits(repo, commits) {
    if (!config.token) {
        console.warn('No GitHub token found. Set GITHUB_TOKEN env variable for API access.');
        return [];
    }

    loadCacheFromDisk(repo);

    const results = [];
    const prNumbers = new Set();
    const commitPRMap = new Map();

    async function processCommit(commit) {
        const sha = commit.hash || commit.commitHash || commit.commit;

        if (!sha) {
            return;
        }

        const message = commit.message || '';

        const prsByHash = await fetchPRsFromCommitHash(repo, sha);
        const prNumbersFromMessage = extractPRNumbers(message);

        const allPRReferences = new Set([
            ...prsByHash.map(pr => pr.number),
            ...prNumbersFromMessage
        ]);

        if (allPRReferences.size > 0) {
            commitPRMap.set(sha, [...allPRReferences]);

            for (const prNumber of allPRReferences) {
                if (!prNumbers.has(prNumber)) {
                    prNumbers.add(prNumber);

                    const prDetails = await fetchPRDetails(repo, prNumber);
                    if (prDetails) {
                        prDetails.relatedCommits.push(sha);
                        results.push(prDetails);
                    }
                } else {
                    const existingPR = results.find(pr => pr.number === prNumber);
                    if (existingPR && !existingPR.relatedCommits.includes(sha)) {
                        existingPR.relatedCommits.push(sha);
                    }
                }
            }
        }
    }

    for (const commit of commits) {
        await processCommit(commit);
    }

    saveCacheToDisk(repo);

    return results;
}

async function matchPRsByMessages(repo, commits) {
    if (!config.token) {
        console.warn('No GitHub token found. Set GITHUB_TOKEN env variable for API access.');
        return [];
    }

    loadCacheFromDisk(repo);

    const results = [];
    const processedPRs = new Set();

    for (const commit of commits) {
        const message = commit.message || '';
        const prNumbers = extractPRNumbers(message);

        for (const prNumber of prNumbers) {
            if (!processedPRs.has(prNumber)) {
                processedPRs.add(prNumber);

                const prDetails = await fetchPRDetails(repo, prNumber);
                if (prDetails) {
                    results.push(prDetails);
                }
            }
        }
    }

    saveCacheToDisk(repo);

    return results;
}

module.exports = {
    fetchPRsByCommits,
    matchPRsByMessages,
    extractPRNumbers
};
