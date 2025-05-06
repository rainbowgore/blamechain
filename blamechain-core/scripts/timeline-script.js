#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config();

let chalk = {
    blue: x => x, green: x => x, yellow: x => x, red: x => x, white: x => x,
    cyan: x => x, magenta: x => x, gray: x => x, underline: x => x,
    bold: { blue: x => x }
};

async function setupChalk() {
    try {
        chalk = (await import('chalk')).default;
    } catch {
        console.warn('⚠️ Could not load chalk. Output will be unstyled.');
    }
}

const {
    fetchPullRequests,
    detectStalePRs
} = require('../src/parsers/githubParser');

function readGraphData() {
    const file = path.join(__dirname, '../output/data/graph.json');
    try {
        const raw = fs.readFileSync(file, 'utf8');
        return JSON.parse(raw);
    } catch (err) {
        console.error(chalk.red('❌ Failed to read graph data:'), err.message);
        return {};
    }
}

function buildTimeline(graph) {
    return Object.entries(graph).map(([commitId, d]) => ({
        commitId,
        author: d.author,
        date: d.date,
        message: d.message,
        pr: d.pr || null,
        related_prs: d.related_prs || [],
        insertions: d.insertions || 0,
        deletions: d.deletions || 0,
        churn: d.churn || 0
    })).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function formatPRInfo(pr) {
    if (!pr) return '';
    const prLink = chalk.cyan(`PR #${pr.number}`);
    const state = pr.state === 'open'
        ? chalk.green('open')
        : pr.merged_at
            ? chalk.magenta('merged')
            : chalk.red('closed');
    let info = ` → ${prLink} [${state}] (${chalk.underline(pr.url)})`;

    if (pr.stats) {
        if (pr.stats.is_stale && pr.state === 'open') info += chalk.yellow(' [STALE]');
        if (pr.stats.reviewer_count > 0) info += `, ${pr.stats.reviewer_count} reviewer(s)`;
        if (pr.stats.approval_count > 0) info += `, ${pr.stats.approval_count} approval(s)`;
    }

    return info;
}

function formatChurn({ insertions, deletions }) {
    const ins = insertions ? chalk.green(`+${insertions}`) : '';
    const del = deletions ? chalk.red(`-${deletions}`) : '';
    return (ins || del) ? ` [${ins}${ins && del ? '/' : ''}${del}]` : '';
}

async function main() {
    await setupChalk();

    const repo = process.env.GITHUB_REPO;
    if (!repo) {
        console.warn(chalk.yellow('⚠️ GITHUB_REPO not set. PR data will be unavailable.'));
    }

    console.log(chalk.blue('Reading graph data...'));
    const graph = readGraphData();

    console.log(chalk.blue('Building timeline...'));
    const timeline = buildTimeline(graph);

    let prs = [];
    if (repo) {
        console.log(chalk.blue(`Fetching PRs for repo: ${repo}`));
        try {
            prs = await fetchPullRequests(repo) || [];
        } catch (err) {
            console.error(chalk.red('❌ Failed to fetch PRs:'), err.message);
        }

        if (prs.length) {
            const stale = detectStalePRs(prs);
            if (stale.length) {
                console.log(chalk.yellow(`⚠️ ${stale.length} stale PR(s):`));
                stale.forEach(pr => console.log(`  - PR #${pr.number}: ${pr.title} (${pr.days_since_update} days stale)`));
            }
        } else {
            console.log(chalk.gray('No PRs found or unable to fetch.'));
        }
    }

    console.log(chalk.bold.blue('\n📅 Timeline:'));
    timeline.forEach(item => {
        const date = chalk.white(new Date(item.date).toISOString().split('T')[0]);
        const author = chalk.yellow(item.author);
        const churn = formatChurn(item);
        const prInfo = formatPRInfo(item.pr);
        console.log(`${date}: ${author} - ${item.message}${churn}${prInfo}`);
        item.related_prs?.forEach(pr =>
            console.log(`  ${chalk.gray('└─')} Related: ${chalk.cyan(`PR #${pr.number}`)} - ${pr.title}`));
    });

    console.log(chalk.bold.blue('\n📊 Summary:'));
    console.log(`Total commits: ${chalk.white(timeline.length)}`);
    console.log(`Unique authors: ${chalk.white(new Set(timeline.map(x => x.author)).size)}`);
    if (prs.length) {
        console.log(`Total PRs: ${chalk.white(prs.length)}`);
        console.log(`Open PRs: ${chalk.white(prs.filter(p => p.state === 'open').length)}`);
        console.log(`Stale PRs: ${chalk.yellow(prs.filter(p => p.stats?.is_stale).length)}`);
    }
}

main().catch(err => {
    console.error(chalk.red('Fatal Error:'), err.message);
    process.exit(1);
});