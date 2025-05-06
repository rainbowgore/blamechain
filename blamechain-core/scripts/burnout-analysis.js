#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
require('dotenv').config();

const {
  analyzeBurnoutRisk,
  generateBurnoutReport,
  BURNOUT_CONSTANTS
} = require('../src/metrics/burnoutInsights');

let chalk = new Proxy({}, {
  get: () => (text => text)
});

async function loadChalk() {
  try {
    chalk = (await import('chalk')).default;
  } catch {
    console.warn('Chalk not available. Output will be uncolored.');
  }
}

const argv = yargs(hideBin(process.argv))
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Path to output markdown file',
    default: '../output/reports/burnout-report.md'
  })
  .option('json', {
    type: 'string',
    description: 'Optional path to output JSON file'
  })
  .option('off-hours-start', {
    type: 'number',
    default: 22
  })
  .option('off-hours-end', {
    type: 'number',
    default: 6
  })
  .option('min-commits', {
    type: 'number',
    default: BURNOUT_CONSTANTS.MIN_COMMITS_FOR_ANALYSIS
  })
  .option('include-weekends', {
    type: 'boolean',
    default: true
  })
  .option('verbose', {
    type: 'boolean',
    default: false
  })
  .help()
  .argv;

function customizeConstants() {
  const constants = structuredClone(BURNOUT_CONSTANTS);
  constants.OFF_HOURS_RANGES = [];

  if (argv.offHoursStart >= argv.offHoursEnd) {
    constants.OFF_HOURS_RANGES.push({ start: argv.offHoursStart, end: 24 });
    constants.OFF_HOURS_RANGES.push({ start: 0, end: argv.offHoursEnd });
  } else {
    constants.OFF_HOURS_RANGES.push({ start: argv.offHoursStart, end: argv.offHoursEnd });
  }

  constants.MIN_COMMITS_FOR_ANALYSIS = argv.minCommits;
  return constants;
}

function loadGraphData() {
  const filePath = path.join(__dirname, '../output/data/graph.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') throw new Error('Empty or invalid structure');
    return parsed;
  } catch (err) {
    console.error(`❌ Failed to load or parse graph.json: ${err.message}`);
    process.exit(1);
  }
}

function extractCommits(graph) {
  return Object.entries(graph)
    .filter(([_, data]) => data.author && data.date)
    .map(([hash, data]) => ({
      hash,
      author: data.author,
      date: data.date,
      message: data.message,
      insertions: data.insertions || 0,
      deletions: data.deletions || 0,
      churn: data.churn || 0
    }))
    .filter(c => !isNaN(Date.parse(c.date)));
}

async function main() {
  await loadChalk();

  console.log(chalk.cyan('→ Loading graph data...'));
  const graphData = loadGraphData();

  const commits = extractCommits(graphData);
  if (!commits.length) {
    console.error('❌ No valid commits found.');
    process.exit(1);
  }

  const constants = customizeConstants();
  const options = {
    constants,
    includeWeekends: argv.includeWeekends
  };

  console.log(chalk.cyan('→ Analyzing burnout patterns...'));
  const analysis = analyzeBurnoutRisk(commits, options);

  const report = generateBurnoutReport(analysis);
  fs.writeFileSync(argv.output, report);
  console.log(chalk.green(`✅ Markdown report saved to ${argv.output}`));

  if (argv.json) {
    fs.writeFileSync(argv.json, JSON.stringify(analysis, null, 2));
    console.log(chalk.green(`✅ JSON data saved to ${argv.json}`));
  }

  if (argv.verbose) {
    console.log(chalk.gray('→ Verbose mode enabled.'));
    console.log(JSON.stringify(analysis.insights.teamInsights, null, 2));
  }
}

main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});