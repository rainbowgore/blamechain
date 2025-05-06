const { matchCommitsToPRs } = require('../parsers/githubParser');

/**
 * Builds a graph structure from commit information, optionally enriched with PR data
 * @param {Array} commits - Array of commit objects
 * @param {Array} prs - Optional array of PR objects from fetchPullRequests
 * @param {Object} options - Optional configuration options
 * @param {boolean} options.includePRs - Whether to include PR information (default: true if prs provided)
 * @returns {Object} Graph object with commit hashes as keys
 */
function buildCommitGraph(commits = [], prs = null, options = {}) {
    const graph = {};

    // Determine if we should process PRs
    const includePRs = options.includePRs !== undefined
        ? options.includePRs
        : (prs !== null && Array.isArray(prs) && prs.length > 0);

    // Enrich commits with PR information if available
    const processedCommits = includePRs
        ? matchCommitsToPRs(commits, prs)
        : commits;

    processedCommits.forEach(commit => {
        const {
            hash,
            author,
            date,
            message,
            pr,
            all_related_prs,
            insertions,
            deletions,
            churn,
            files
        } = commit;

        // Base graph node
        graph[hash] = {
            author,
            date,
            message,
            ...(insertions !== undefined && { insertions }),
            ...(deletions !== undefined && { deletions }),
            ...(churn !== undefined && { churn }),
            files: files || []
        };

        if (includePRs && pr) {
            graph[hash].pr = {
                number: pr.number,
                title: pr.title,
                url: pr.url,
                state: pr.state,
                author: pr.author,
                created_at: pr.created_at,
                updated_at: pr.updated_at,
                merged_at: pr.merged_at,
                closed_at: pr.closed_at,
                match_type: pr.match_type
            };

            if (pr.stats) {
                graph[hash].pr.stats = {
                    reviewer_count: pr.stats.reviewer_count,
                    approval_count: pr.stats.approval_count,
                    days_since_creation: pr.stats.days_since_creation,
                    days_since_update: pr.stats.days_since_update,
                    time_to_close: pr.stats.time_to_close,
                    is_stale: pr.stats.is_stale
                };
            }
        }

        if (includePRs && all_related_prs && all_related_prs.length > 1) {
            graph[hash].related_prs = all_related_prs.map(relatedPr => ({
                number: relatedPr.number,
                title: relatedPr.title,
                url: relatedPr.url
            }));
        }
    });

    return graph;
}

module.exports = { buildCommitGraph };