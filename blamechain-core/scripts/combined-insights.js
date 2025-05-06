// combined-insights.js — Fully Refactored

const fs = require('fs');
const { execSync } = require('child_process');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
require('dotenv').config();

let chalk = {
  red: t => t, yellow: t => t, green: t => t, blue: t => t, cyan: t => t,
  bold: { red: t => t, yellow: t => t, green: t => t, blue: t => t }
};

async function setupChalk() {
  try {
    chalk = (await import('chalk')).default;
  } catch {
    console.warn('⚠️ Could not load chalk. Output will be uncolored.');
  }
}

const argv = yargs(hideBin(process.argv))
  .option('output', { alias: 'o', type: 'string', default: 'output/reports/combined-insights-report.md' })
  .option('json', { alias: 'j', type: 'string' })
  .option('verbose', { alias: 'v', type: 'boolean', default: false })
  .help().argv;

function tryLoad(modulePath) {
  try {
    return require(modulePath);
  } catch {
    return null;
  }
}

function tryReadJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch (e) {
    console.warn(`⚠️ Failed to load ${filepath}: ${e.message}`);
    return null;
  }
}

async function runFallbackScript(scriptName) {
  try {
    const tmpPath = `output/tmp-${scriptName}.json`;
    execSync(`node scripts/${scriptName} --json ${tmpPath}`, {
      stdio: argv.verbose ? 'inherit' : 'pipe'
    });
    return tryReadJSON(tmpPath);
  } catch (e) {
    console.error(`❌ Error running ${scriptName}: ${e.message}`);
    return null;
  }
}

async function main() {
  await setupChalk();
  console.log(chalk.blue.bold('Starting Combined Insights Analysis...'));

  const graph = tryReadJSON('output/data/graph.json');
  if (!graph) return;

  const commitHistory = Object.entries(graph).map(([hash, data]) => ({ hash, ...data }));

  const ownershipModule = tryLoad('../src/metrics/ownershipInsights');
  const burnoutModule = tryLoad('../src/metrics/burnoutInsights');
  const featureModule = tryLoad('../src/metrics/featureDeathInsights');
  const insightsModule = tryLoad('../src/insights/automatedInsights');

  const ownershipData = ownershipModule?.analyze?.(commitHistory)
    || tryReadJSON('output/data/ownership-metrics.json')
    || await runFallbackScript('ownership-analysis.js');

  const burnoutData = burnoutModule?.analyzeBurnoutRisk?.(commitHistory, {
    constants: burnoutModule?.BURNOUT_CONSTANTS
  }) || tryReadJSON('output/data/burnout-metrics.json')
    || await runFallbackScript('burnout-analysis.js');

  const featureInput = tryReadJSON('output/data/todo-metrics.json');
  const featureData = featureModule?.analyzeFeatureDeath?.(featureInput)
    || tryReadJSON('output/data/feature-metrics.json')
    || await runFallbackScript('feature-death-analysis.js');

  if (!insightsModule?.generateCombinedInsights) {
    console.error('❌ automatedInsights module not available.');
    return;
  }

  const combined = insightsModule.generateCombinedInsights(
    { ownershipData, burnoutData, featureData },
    {} // config support could be extended here
  );

  fs.writeFileSync(argv.output, combined.markdownReport || '');
  console.log(chalk.green(`✅ Markdown report written to: ${argv.output}`));

  if (argv.json) {
    fs.writeFileSync(argv.json, JSON.stringify(combined, null, 2));
    console.log(chalk.green(`✅ JSON data written to: ${argv.json}`));
  }
}

main();