#!/usr/bin/env node

const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { analyzeFileHistory } = require('../src/parsers/gitParser');
const { generateSummary } = require('../src/utils/generateSummary');
const { extractRepoInfo } = require('../src/utils/repoDetector');

const argv = yargs(hideBin(process.argv))
    .option('repo', {
        alias: 'r',
        type: 'string',
        description: 'GitHub repo in format owner/repo',
    })
    .option('target', {
        alias: 't',
        type: 'string',
        description: 'Target file path to analyze',
    })
    .help()
    .argv;

const repo = argv.repo || process.env.GITHUB_REPO || extractRepoInfo();

if (!repo) {
    console.warn('[!] Repo not detected. Please provide --repo or set it in your .git/config.');
    process.exit(1);
}

if (argv.target) {
    const absolutePath = path.resolve(argv.target);
    analyzeFileHistory(absolutePath)
        .then(result => {
            generateSummary({
                commits: result.commits,
                contributors: result.contributors || [],
                todos: result.todos || [],
                pullRequests: result.pullRequests || [],
                complexity: result.complexity || {}
            }, { export: true });
        })
        .catch(err => {
            console.error('[!] Error analyzing file history:', err.message);
        });
} else {
    analyzeFileHistory(process.cwd())
        .then(result => {
            generateSummary({
                commits: result.commits,
                contributors: result.contributors || [],
                todos: result.todos || [],
                pullRequests: result.pullRequests || [],
                complexity: result.complexity || {}
            }, { export: true });
        })
        .catch(err => {
            console.error('[!] Error analyzing repo:', err.message);
        });
}