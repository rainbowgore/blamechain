const axios = require('axios');
require('dotenv').config();

const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPO;

async function fetchGitHubMetadata(filePath, repo = defaultRepo) {
    if (!token) {
        console.warn('[githubParser] No GITHUB_TOKEN. Skipping GitHub API.');
        return null;
    }

    try {
        const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;
        const res = await axios.get(url, {
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
            }
        });
        return res.data;
    } catch (err) {
        console.error(`[githubParser] Failed to fetch from GitHub: ${err.message}`);
        return null;
    }
}

async function fetchPullRequests(repo = defaultRepo, options = {}) {
    if (!token) {
        console.warn('[githubParser] No GITHUB_TOKEN. Skipping GitHub API.');
        return null;
    }

    const {
        state = 'all',
        perPage = 30,
        maxPages = 5
    } = options;

    try {
        let allPRs = [];
        let page = 1;
        let hasMorePages = true;

        while (hasMorePages && page <= maxPages) {
            const url = `https://api.github.com/repos/${repo}/pulls?state=${state}&per_page=${perPage}&page=${page}`;
            const res = await axios.get(url, {
                headers: {
                    Authorization: `token ${token}`,
                    Accept: 'application/vnd.github.v3+json',
                }
            });

            const prs = res.data;
            allPRs = [...allPRs, ...prs];
            hasMorePages = prs.length === perPage;
            page++;
        }

        const enhancedPRs = await Promise.all(
            allPRs.map(async pr => {
                const commitsUrl = `https://api.github.com/repos/${repo}/pulls/${pr.number}/commits`;
                const commitsRes = await axios.get(commitsUrl, {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: 'application/vnd.github.v3+json',
                    }
                });

                const reviewsUrl = `https://api.github.com/repos/${repo}/pulls/${pr.number}/reviews`;
                const reviewsRes = await axios.get(reviewsUrl, {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: 'application/vnd.github.v3+json',
                    }
                });

                const reviewers = new Set(reviewsRes.data.map(review => review.user.login));
                const approvals = reviewsRes.data.filter(review => review.state === 'APPROVED').length;

                const createdAt = new Date(pr.created_at);
                const updatedAt = new Date(pr.updated_at);
                const closedAt = pr.closed_at ? new Date(pr.closed_at) : null;

                const daysSinceCreation = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));
                const daysSinceUpdate = Math.floor((Date.now() - updatedAt) / (1000 * 60 * 60 * 24));
                const timeToClose = closedAt ? Math.floor((closedAt - createdAt) / (1000 * 60 * 60 * 24)) : null;

                return {
                    ...pr,
                    commits: commitsRes.data,
                    commit_hashes: commitsRes.data.map(commit => commit.sha),
                    commit_messages: commitsRes.data.map(commit => commit.commit.message),
                    reviews: reviewsRes.data,
                    stats: {
                        reviewer_count: reviewers.size,
                        approval_count: approvals,
                        days_since_creation: daysSinceCreation,
                        days_since_update: daysSinceUpdate,
                        time_to_close: timeToClose,
                        is_stale: daysSinceUpdate > 14 && pr.state === 'open'
                    }
                };
            })
        );

        return enhancedPRs;
    } catch (err) {
        console.error(`[githubParser] Failed to fetch PRs from GitHub: ${err.message}`);
        return null;
    }
}

function matchCommitsToPRs(commits, prs) {
    if (!prs || prs.length === 0) {
        return commits;
    }

    return commits.map(commit => {
        const matchingPRsByHash = prs.filter(pr => pr.commit_hashes.includes(commit.hash));

        const matchingPRsByMessage = matchingPRsByHash.length === 0
            ? prs.filter(pr =>
                pr.commit_messages.some(msg =>
                    (msg && commit.message && msg.includes(commit.message)) ||
                    (commit.message && msg && commit.message.includes(msg)) ||
                    (commit.message && pr.title && commit.message.includes(pr.title)) ||
                    (pr.title && commit.message && pr.title.includes(commit.message))
                )
            )
            : [];

        const matchingPRs = [...matchingPRsByHash, ...matchingPRsByMessage];

        const bestMatch = matchingPRs.length > 0
            ? matchingPRsByHash.length > 0
                ? matchingPRsByHash.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0]
                : matchingPRsByMessage.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0]
            : null;

        return {
            ...commit,
            pr: bestMatch ? {
                number: bestMatch.number,
                title: bestMatch.title,
                url: bestMatch.html_url,
                state: bestMatch.state,
                author: bestMatch.user.login,
                created_at: bestMatch.created_at,
                updated_at: bestMatch.updated_at,
                closed_at: bestMatch.closed_at,
                merged_at: bestMatch.merged_at,
                stats: bestMatch.stats,
                match_type: matchingPRsByHash.includes(bestMatch) ? 'hash' : 'message'
            } : null,
            all_related_prs: matchingPRs.map(pr => ({
                number: pr.number,
                title: pr.title,
                url: pr.html_url
            }))
        };
    });
}

function detectStalePRs(prs, options = {}) {
    const { daysStale = 14 } = options;

    if (!prs || prs.length === 0) {
        return [];
    }

    return prs
        .filter(pr => pr.state === 'open' && pr.stats.days_since_update >= daysStale)
        .map(pr => ({
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            author: pr.user.login,
            created_at: pr.created_at,
            days_since_update: pr.stats.days_since_update,
            reviewer_count: pr.stats.reviewer_count
        }))
        .sort((a, b) => b.days_since_update - a.days_since_update);
}

module.exports = {
    fetchGitHubMetadata,
    fetchPullRequests,
    matchCommitsToPRs,
    detectStalePRs
};