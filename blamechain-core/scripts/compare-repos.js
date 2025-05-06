#!/usr/bin/env node

/**
 * Repository Comparison Tool
 * 
 * A tool to compare statistics across multiple Git repositories.
 * 
 * Usage:
 *   node compare-repos.js --repos repo1,repo2,repo3 [options]
 * 
 * Options:
 *   --repos, -r       Comma-separated paths to repositories     [required]
 *   --names, -n       Comma-separated names for repositories    [optional]
 *   --output, -o      Output Markdown file path                 [default: "repo-comparison.md"]
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Import modules
const { validateRepositories } = require('../src/comparison/repoValidator');
const { extractRepoStats } = require('../src/comparison/statsExtractor');
const { generateFullReport } = require('../src/comparison/reportGenerator');

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('repos', {
    alias: 'r',
    description: 'Comma-separated paths to repositories',
    type: 'string',
    demandOption: true
  })
  .option('names', {
    alias: 'n',
    description: 'Comma-separated names for repositories',
    type: 'string'
  })
  .option('output', {
    alias: 'o',
    description: 'Output Markdown file path',
    type: 'string',
    default: '../output/reports/repo-comparison.md'
  })
  .help()
  .alias('help', 'h')
  .argv;

// Main function
function main() {
  try {
    console.log('Repository Comparison Tool');
    
    // Parse repository paths and names
    const repoPaths = argv.repos.split(',').map(r => r.trim());
    let repoNames = argv.names ? argv.names.split(',').map(n => n.trim()) : [];
    
    // Use directory names for missing repo names
    if (repoNames.length < repoPaths.length) {
      repoPaths.forEach((repoPath, index) => {
        if (index >= repoNames.length) {
          repoNames.push(path.basename(repoPath));
        }
      });
    }
    
    // Validate repositories
    const validRepos = validateRepositories(repoPaths, repoNames);
    
    if (validRepos.length === 0) {
      console.error('Error: No valid Git repositories found.');
      process.exit(1);
    }
    
    // Analyze each repository
    const repoStats = [];
    
    for (const repo of validRepos) {
      console.log(`Analyzing repository: ${repo.name}`);
      const stats = extractRepoStats(repo.path);
      
      if (stats) {
        repoStats.push({
          name: repo.name,
          stats
        });
      }
    }
    
    // Generate comparison report
    const report = generateFullReport(repoStats);
    
    // Write report to file
    fs.writeFileSync(argv.output, report);
    console.log(`Comparison report saved to ${argv.output}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main();
