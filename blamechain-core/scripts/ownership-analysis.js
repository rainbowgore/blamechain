#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const {
  analyzeOwnershipDrift,
  generateOwnershipReport,
  OWNERSHIP_CONSTANTS
} = require('../src/metrics/ownershipInsights');

const argv = yargs(hideBin(process.argv))
  .option('output', {
    alias: 'o',
    type: 'string',
    default: '../output/reports/ownership-report.md',
    describe: 'Path to save the markdown report'
  })
  .option('json', {
    type: 'string',
    describe: 'Optional path to save JSON output'
  })
  .option('window', {
    type: 'number',
    default: OWNERSHIP_CONSTANTS.RAPID_CHANGE_WINDOW_DAYS,
    describe: 'Days for rapid ownership change window'
  })
  .option('threshold', {
    type: 'number',
    default: OWNERSHIP_CONSTANTS.RAPID_CHANGE_THRESHOLD,
    describe: 'Number of changes to count as rapid ownership churn'
  })
  .help()
  .argv;

function loadCommitGraph() {
  const graphPath = path.join(__dirname, '../output/data/graph.json');
  if (!fs.existsSync(graphPath)) {
    console.error(`❌ graph.json not found at ${graphPath}`);
    process.exit(1);
  }

  try {
    const raw = fs.readFileSync(graphPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`❌ Failed to parse graph.json: ${err.message}`);
    process.exit(1);
  }
}

function extractCommits(graph) {
  return Object.entries(graph)
    .filter(([_, d]) => d.author && d.date && Array.isArray(d.files))
    .map(([hash, d]) => ({
      hash,
      author: d.author,
      date: d.date,
      message: d.message,
      files: d.files
    }));
}

function run() {
  const graph = loadCommitGraph();
  const commits = extractCommits(graph);

  if (commits.length === 0) {
    console.error('❌ No valid commits found for analysis.');
    process.exit(1);
  }

  const analysis = analyzeOwnershipDrift(commits, {
    windowDays: argv.window,
    rapidChangeThreshold: argv.threshold
  });

  const markdown = generateOwnershipReport(analysis);
  const outputDir = path.dirname(argv.output);  
  fs.mkdirSync(outputDir, { recursive: true });  // ✅ Ensure directory exists
  fs.writeFileSync(argv.output, markdown);
  console.log(`✅ Ownership report saved to: ${argv.output}`);

  if (argv.json) {
    fs.writeFileSync(argv.json, JSON.stringify(analysis, null, 2));
    console.log(`✅ JSON output saved to: ${argv.json}`);
  }
}

run();