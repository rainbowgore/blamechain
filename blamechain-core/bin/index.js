#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
require('dotenv').config();

const config = require('../src/config');
const { analyzeFileHistory } = require('../src/parsers/gitParser');
const { extractTodos } = require('../src/parsers/todoScanner');
const { fetchGitHubMetadata } = require('../src/parsers/githubParser');
const { generateSummary } = require('../src/summarizer/summaryEngine');
const { listBranches } = require('../src/parsers/branchTracker');

const args = process.argv.slice(2);
const target = args.find(arg => !arg.startsWith('--'));
const flags = {
    json: args.includes('--json')
};

if (!target) {
    console.error('Usage: blamechain <file-path> [--json]');
    process.exit(1);
}

const absolutePath = path.resolve(target);
console.log(`📁 Analyzing: ${absolutePath}`);

(async () => {
    try {
        if (!fs.existsSync(absolutePath)) {
            console.error(` File not found: ${absolutePath}`);
            process.exit(1);
        }

        const gitResult = await analyzeFileHistory(absolutePath);
        const todos = extractTodos(absolutePath);
        const metadata = await fetchGitHubMetadata(absolutePath);
        await listBranches();

        if (gitResult) {
            generateSummary(
                {
                    commits: gitResult.commits,
                    contributors: gitResult.contributors,
                    todos,
                    metadata
                },
                flags
            );
        } else {
            console.warn('⚠️ No Git data found for file.');
        }
    } catch (err) {
        console.error('🔥 Fatal error in blamechain CLI:', err.message);
        if (config.VERBOSE) console.error(err.stack);
        process.exit(1);
    }
})();