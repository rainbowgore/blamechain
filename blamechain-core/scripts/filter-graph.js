#!/usr/bin/env node

/**
 * Filter Graph Visualization Script
 * 
 * This script provides filtering capabilities for the commit graph visualization, allowing
 * users to filter commits by author, date range, churn threshold, and PR status.
 * 
 * Usage:
 *   node filter-graph.js [options]
 * 
 * Filter Options:
 *   --author <string>      Filter by author name (case-insensitive, partial match)
 *   --from <date>          Filter commits from this date (format: YYYY-MM-DD)
 *   --to <date>            Filter commits until this date (format: YYYY-MM-DD)
 *   --risk <string>        Filter by risk level: high, medium, low, or none
 *   --min-churn <number>   Filter commits with at least this much churn
 *   --has-pr <boolean>     Filter commits that have/don't have PRs
 * 
 * Output Options:
 *   --output <string>      Output file name (default: "filtered-graph.png")
 *   --json <string>        Output filtered graph to JSON file
 *   --format <string>      Output format: daily or aggregated (default: "daily")
 *   --help                 Show help
 */

// Import required modules
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
require('dotenv').config();

// Import timeline and visualization utilities
const { buildTimeline } = require('../src/graph/timelineBuilder');

// Chalk will be dynamically imported as it's an ESM module
let chalk = {
  red: text => text,
  yellow: text => text,
  green: text => text,
  blue: text => text,
  cyan: text => text,
  magenta: text => text,
  gray: text => text,
  white: text => text,
  bold: {
    blue: text => text,
    green: text => text,
    red: text => text,
    yellow: text => text
  }
};

// Function to dynamically import chalk (as it's ESM-only)
async function setupChalk() {
  try {
    chalk = (await import('chalk')).default;
    return true;
  } catch (error) {
    console.warn('Could not load chalk for colored output. Using plain text instead.');
    return false;
  }
}

// Constants for risk thresholds
const HIGH_CHURN_THRESHOLD = 500;
const MEDIUM_CHURN_THRESHOLD = 200;
const LOW_CHURN_THRESHOLD = 50;

// Colors for risk levels and visualization
const COLORS = {
  HIGH_RISK: '#FF3A33', // Red
  MEDIUM_RISK: '#FFA500', // Orange
  LOW_RISK: '#4CAF50', // Green
  NO_RISK: '#AAAAAA', // Gray
  DEFAULT: '#000000', // Black
  BACKGROUND: '#FFFFFF', // White
  HIGHLIGHT: '#FFFF00', // Yellow
  HEADING: '#333333', // Dark gray
  GRID: '#EEEEEE', // Light gray
  PR_INDICATOR: '#4A86E8', // Blue
  FILTERED_OUT: '#DDDDDD' // Light gray for filtered out items
};

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  // Filter options
  .option('author', {
    description: 'Filter by author name (case-insensitive, partial match)',
    type: 'string'
  })
  .option('from', {
    description: 'Filter commits from this date (format: YYYY-MM-DD)',
    type: 'string'
  })
  .option('to', {
    description: 'Filter commits until this date (format: YYYY-MM-DD)',
    type: 'string'
  })
  .option('risk', {
    description: 'Filter by risk level: high, medium, low, or none',
    type: 'string',
    choices: ['high', 'medium', 'low', 'none']
  })
  .option('min-churn', {
    description: 'Filter commits with at least this much churn',
    type: 'number'
  })
  .option('has-pr', {
    description: 'Filter commits that have/don\'t have PRs',
    type: 'boolean'
  })
  // Output options
  .option('output', {
    alias: 'o',
    description: 'Output file name',
    type: 'string',
    default: 'filtered-graph.png'
  })
  .option('json', {
    description: 'Output filtered graph to JSON file',
    type: 'string'
  })
  .option('format', {
    description: 'Output format: daily or aggregated',
    type: 'string',
    choices: ['daily', 'aggregated'],
    default: 'daily'
  })
  .help()
  .alias('help', 'h')
  .argv;

/**
 * Determine risk level based on churn
 * @param {number} churn - Total churn value
 * @returns {string} - Risk level: high, medium, low, or none
 */
function getRiskLevel(churn) {
  if (churn >= HIGH_CHURN_THRESHOLD) return 'high';
  if (churn >= MEDIUM_CHURN_THRESHOLD) return 'medium';
  if (churn >= LOW_CHURN_THRESHOLD) return 'low';
  return 'none';
}

/**
 * Get color for risk level
 * @param {string} risk - Risk level
 * @returns {string} - Color code
 */
function getRiskColor(risk) {
  switch (risk) {
    case 'high': return COLORS.HIGH_RISK;
    case 'medium': return COLORS.MEDIUM_RISK;
    case 'low': return COLORS.LOW_RISK;
    case 'none': 
    default: return COLORS.NO_RISK;
  }
}

/**
 * Format date for display
 * @param {string} dateString - Date string
 * @returns {string} - Formatted date
 */
function formatDate(dateString) {
  return new Date(dateString).toISOString().split('T')[0];
}

/**
 * Format churn metrics for display
 * @param {Object} commit - Commit object
 * @returns {string} - Formatted churn string
 */
function formatChurnMetrics(commit) {
  const insertions = commit.insertions || 0;
  const deletions = commit.deletions || 0;
  const churn = commit.churn || 0;
  
  return `[+${insertions}/-${deletions}, churn: ${churn}]`;
}

/**
 * Read graph data from JSON file
 * @returns {Object} - Graph data
 */
function readGraphData() {
  try {
    const graphFile = path.join(__dirname, '../output/data/graph.json');
    const graphData = fs.readFileSync(graphFile, 'utf8');
    return JSON.parse(graphData);
  } catch (error) {
    console.error(`Error reading graph.json: ${error.message}`);
    return {};
  }
}

/**
 * Process graph data into commits array
 * @param {Object} graphData - Graph object from JSON
 * @returns {Array} - Array of commit objects
 */
function processGraphData(graphData) {
  return Object.entries(graphData).map(([hash, data]) => ({
    hash,
    date: data.date,
    author: data.author,
    message: data.message,
    insertions: data.insertions || 0,
    deletions: data.deletions || 0,
    churn: data.churn || (data.insertions || 0) + (data.deletions || 0),
    pr: data.pr || null,
    related_prs: data.related_prs || [],
    risk: getRiskLevel(data.churn || (data.insertions || 0) + (data.deletions || 0))
  }));
}

/**
 * Apply filters to commits based on command line arguments
 * @param {Array} commits - Array of commit objects
 * @param {Object} filters - Filter options
 * @returns {Object} - Filtered commits and filter summary
 */
function filterCommits(commits, filters) {
  const originalCount = commits.length;
  let filteredCommits = [...commits];
  const appliedFilters = [];
  
  // Filter by author
  if (filters.author) {
    const authorPattern = new RegExp(filters.author, 'i');
    filteredCommits = filteredCommits.filter(commit => 
      authorPattern.test(commit.author)
    );
    appliedFilters.push(`Author: "${filters.author}"`);
  }
  
  // Filter by date range (from)
  if (filters.from) {
    const fromDate = new Date(filters.from);
    filteredCommits = filteredCommits.filter(commit => 
      new Date(commit.date) >= fromDate
    );
    appliedFilters.push(`From: ${formatDate(filters.from)}`);
  }
  
  // Filter by date range (to)
  if (filters.to) {
    const toDate = new Date(filters.to);
    toDate.setHours(23, 59, 59, 999); // End of day
    filteredCommits = filteredCommits.filter(commit => 
      new Date(commit.date) <= toDate
    );
    appliedFilters.push(`To: ${formatDate(filters.to)}`);
  }
  
  // Filter by risk level
  if (filters.risk) {
    filteredCommits = filteredCommits.filter(commit => 
      commit.risk === filters.risk
    );
    appliedFilters.push(`Risk level: ${filters.risk}`);
  }
  
  // Filter by minimum churn
  if (filters.minChurn !== undefined) {
    filteredCommits = filteredCommits.filter(commit => 
      commit.churn >= filters.minChurn
    );
    appliedFilters.push(`Minimum churn: ${filters.minChurn}`);
  }
  
  // Filter by PR status
  if (filters.hasPr !== undefined) {
    filteredCommits = filteredCommits.filter(commit => 
      (commit.pr !== null) === filters.hasPr
    );
    appliedFilters.push(`Has PR: ${filters.hasPr}`);
  }
  
  // Generate filter summary
  const filterSummary = {
    totalCommits: originalCount,
    filteredCommits: filteredCommits.length,
    filtersApplied: appliedFilters,
    percentageKept: Math.round((filteredCommits.length / originalCount) * 100)
  };
  
  return { filteredCommits, filterSummary };
}

/**
 * Generate metrics for filtered commits
 * @param {Array} commits - Filtered commit array
 * @returns {Object} - Metrics object
 */
function generateMetrics(commits) {
  if (commits.length === 0) {
    return {
      totalCommits: 0,
      totalChurn: 0,
      avgChurn: 0,
      highRiskCommits: 0,
      mediumRiskCommits: 0,
      lowRiskCommits: 0,
      noRiskCommits: 0,
      commitsWithPRs: 0,
      authors: [],
      earliestDate: null,
      latestDate: null
    };
  }
  
  // Calculate metrics
  const authorMap = {};
  let totalChurn = 0;
  let highRiskCommits = 0;
  let mediumRiskCommits = 0;
  let lowRiskCommits = 0;
  let noRiskCommits = 0;
  let commitsWithPRs = 0;
  
  // Sort commits by date
  const sortedCommits = [...commits].sort((a, b) => new Date(a.date) - new Date(b.date));
  const earliestDate = new Date(sortedCommits[0].date);
  const latestDate = new Date(sortedCommits[sortedCommits.length - 1].date);
  
  // Process each commit
  commits.forEach(commit => {
    // Track author
    const author = commit.author || 'unknown';
    authorMap[author] = (authorMap[author] || 0) + 1;
    
    // Track churn
    totalChurn += commit.churn || 0;
    
    // Track risk level
    switch (commit.risk) {
      case 'high': highRiskCommits++; break;
      case 'medium': mediumRiskCommits++; break;
      case 'low': lowRiskCommits++; break;
      case 'none': noRiskCommits++; break;
    }
    
    // Track PRs
    if (commit.pr !== null) {
      commitsWithPRs++;
    }
  });
  
  // Format author stats
  const authors = Object.entries(authorMap).map(([name, count]) => ({
    name,
    count,
    percentage: Math.round((count / commits.length) * 100)
  })).sort((a, b) => b.count - a.count);
  
  return {
    totalCommits: commits.length,
    totalChurn,
    avgChurn: Math.round(totalChurn / commits.length),
    highRiskCommits,
    mediumRiskCommits,
    lowRiskCommits,
    noRiskCommits,
    commitsWithPRs,
    authors,
    earliestDate,
    latestDate
  };
}

/**
 * Generate visualization of filtered graph
 * @param {Array} allCommits - All commits
 * @param {Array} filteredCommits - Filtered commits
 * @param {Object} filterSummary - Filter summary info
 * @param {Object} metrics - Metrics for filtered commits
 * @param {string} outputFile - Output file path
 */
function generateFilteredVisualization(allCommits, filteredCommits, filterSummary, metrics, outputFile) {
  // Create a lookup for filtered commit hashes for quick checking
  const filteredHashLookup = {};
  filteredCommits.forEach(commit => {
    filteredHashLookup[commit.hash] = true;
  });
  
  // Sort all commits by date for visualization
  const sortedCommits = [...allCommits].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Calculate canvas dimensions
  const rowHeight = 30;
  const headerHeight = 180; // Increased for filter summary
  const footerHeight = 60;
  const padding = 20;
  const canvasWidth = 1200;
  const canvasHeight = headerHeight + (rowHeight * sortedCommits.length) + footerHeight;
  
  // Create canvas
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  
  // Draw background
  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Draw title
  ctx.fillStyle = COLORS.HEADING;
  ctx.font = 'bold 24px Arial';
  ctx.fillText('Filtered Commit Graph', padding, padding + 10);
  
  // Draw filter summary
  ctx.font = '14px Arial';
  
  // Information about filters applied
  const filterText = filterSummary.filtersApplied.length > 0 
    ? `Filters applied: ${filterSummary.filtersApplied.join(', ')}` 
    : 'No filters applied';
    
  ctx.fillText(filterText, padding, padding + 40);
  
  // Information about how many commits were filtered
  ctx.fillText(
    `Showing ${filterSummary.filteredCommits} out of ${filterSummary.totalCommits} commits (${filterSummary.percentageKept}%)`, 
    padding, 
    padding + 60
  );
  
  // Draw metrics
  if (metrics.totalCommits > 0) {
    // Date range
    const dateRange = metrics.earliestDate && metrics.latestDate 
      ? `Date range: ${formatDate(metrics.earliestDate)} to ${formatDate(metrics.latestDate)}`
      : '';
      
    if (dateRange) {
      ctx.fillText(dateRange, padding, padding + 80);
    }
    
    // Churn metrics
    ctx.fillText(
      `Total churn: ${metrics.totalChurn}, Average churn per commit: ${metrics.avgChurn}`,
      padding,
      padding + 100
    );
    
    // PR metrics
    ctx.fillText(
      `Commits with PRs: ${metrics.commitsWithPRs} (${Math.round((metrics.commitsWithPRs / metrics.totalCommits) * 100)}%)`,
      padding,
      padding + 120
    );
  }
  
  // Draw legend
  const legendY = headerHeight - 50;
  const legendGap = 180;
  
  // High risk legend
  ctx.fillStyle = COLORS.HIGH_RISK;
  ctx.fillRect(padding, legendY, 15, 15);
  ctx.fillStyle = COLORS.HEADING;
  ctx.fillText(`High Risk (${metrics.highRiskCommits})`, padding + 20, legendY + 12);
  
  // Medium risk legend
  ctx.fillStyle = COLORS.MEDIUM_RISK;
  ctx.fillRect(padding + legendGap, legendY, 15, 15);
  ctx.fillStyle = COLORS.HEADING;
  ctx.fillText(`Medium Risk (${metrics.mediumRiskCommits})`, padding + legendGap + 20, legendY + 12);
  
  // Low risk legend
  ctx.fillStyle = COLORS.LOW_RISK;
  ctx.fillRect(padding + (legendGap * 2), legendY, 15, 15);
  ctx.fillStyle = COLORS.HEADING;
  ctx.fillText(`Low Risk (${metrics.lowRiskCommits})`, padding + (legendGap * 2) + 20, legendY + 12);
  
  // PR legend
  ctx.fillStyle = COLORS.PR_INDICATOR;
  ctx.fillRect(padding + (legendGap * 3), legendY, 15, 15);
  ctx.fillStyle = COLORS.HEADING;
  ctx.fillText(`Has PR (${metrics.commitsWithPRs})`, padding + (legendGap * 3) + 20, legendY + 12);
  
  // Filtered/Not filtered legend
  ctx.fillStyle = COLORS.HIGHLIGHT;
  ctx.fillRect(padding + (legendGap * 4), legendY, 15, 15);
  ctx.fillStyle = COLORS.HEADING;
  ctx.fillText('Filtered In', padding + (legendGap * 4) + 20, legendY + 12);
  
  // Draw column headers
  ctx.fillStyle = COLORS.HEADING;
  ctx.font = 'bold 14px Arial';
  
  const hashX = padding;
  const dateX = padding + 150;
  const authorX = padding + 300;
  const messageX = padding + 450;
  const churnX = padding + 750;
  const prX = padding + 950;
  const headerY = headerHeight - 10;
  
  ctx.fillText('Commit Hash', hashX, headerY);
  ctx.fillText('Date', dateX, headerY);
  ctx.fillText('Author', authorX, headerY);
  ctx.fillText('Message', messageX, headerY);
  ctx.fillText('Churn Metrics', churnX, headerY);
  ctx.fillText('PR Info', prX, headerY);
  
  // Draw separator line
  ctx.strokeStyle = COLORS.HEADING;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, headerHeight);
  ctx.lineTo(canvasWidth - padding, headerHeight);
  ctx.stroke();
  
  // Draw commits
  sortedCommits.forEach((commit, i) => {
    const rowY = headerHeight + (i * rowHeight) + 20;
    const isFiltered = filteredHashLookup[commit.hash];
    
    // Set color and opacity based on whether the commit is filtered
    if (isFiltered) {
      // Highlight filtered commits
      ctx.fillStyle = COLORS.HIGHLIGHT;
      ctx.fillRect(padding - 10, rowY - 15, canvasWidth - (padding * 2) + 20, rowHeight);
    }
    
    // Choose text color based on whether the commit is filtered
    ctx.fillStyle = isFiltered ? COLORS.DEFAULT : COLORS.FILTERED_OUT;
    
    // Draw commit hash (first 7 characters)
    ctx.fillText(commit.hash.slice(0, 7), hashX, rowY);
    
    // Draw date
    const formattedDate = formatDate(commit.date);
    ctx.fillText(formattedDate, dateX, rowY);
    
    // Draw author
    ctx.fillText(commit.author, authorX, rowY);
    
    // Draw message (truncated if too long)
    const truncatedMessage = commit.message.length > 30 
      ? commit.message.substring(0, 27) + '...' 
      : commit.message;
    ctx.fillText(truncatedMessage, messageX, rowY);
    
    // Draw churn metrics with risk color
    ctx.fillStyle = isFiltered ? getRiskColor(commit.risk) : COLORS.FILTERED_OUT;
    ctx.fillText(formatChurnMetrics(commit), churnX, rowY);
    
    // Draw PR info
    if (commit.pr) {
      ctx.fillStyle = isFiltered ? COLORS.PR_INDICATOR : COLORS.FILTERED_OUT;
      ctx.fillText(`PR #${commit.pr.number}`, prX, rowY);
    }
    
    // Draw separator line
    ctx.strokeStyle = COLORS.GRID;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padding, rowY + 10);
    ctx.lineTo(canvasWidth - padding, rowY + 10);
    ctx.stroke();
  });
  
  // Draw footer
  ctx.fillStyle = COLORS.HEADING;
  ctx.font = '12px Arial';
  ctx.fillText(
    `Generated with blamechain - ${new Date().toISOString()}`,
    padding,
    canvasHeight - padding
  );
  
  // Write image to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputFile, buffer);
  console.log(`Filtered visualization exported to ${outputFile}`);
}

/**
 * Convert filtered commits to JSON format for export
 * @param {Array} filteredCommits - Filtered commits array
 * @param {string} outputFile - Output file path
 */
function exportFilteredJSON(filteredCommits, outputFile) {
  // Convert the array back to an object with hash keys
  const graphObject = {};
  
  filteredCommits.forEach(commit => {
    graphObject[commit.hash] = {
      date: commit.date,
      author: commit.author,
      message: commit.message,
      insertions: commit.insertions,
      deletions: commit.deletions,
      churn: commit.churn,
      pr: commit.pr,
      related_prs: commit.related_prs,
      risk: commit.risk
    };
  });
  
  fs.writeFileSync(outputFile, JSON.stringify(graphObject, null, 2));
  console.log(`Filtered commit data exported to ${outputFile}`);
}

/**
 * Display filtered commits in the console
 * @param {Array} filteredCommits - Filtered commits array
 * @param {Object} filterSummary - Filter summary info
 * @param {Object} metrics - Metrics for filtered commits
 */
async function displayFilteredCommits(filteredCommits, filterSummary, metrics) {
  // Ensure chalk is set up
  await setupChalk();
  
  console.log(chalk.bold.blue('\nFiltered Commit Graph'));
  console.log(chalk.bold('──────────────────────────────────────────────'));
  
  // Display filter summary
  console.log(chalk.blue('Filter Summary:'));
  
  if (filterSummary.filtersApplied.length > 0) {
    console.log(`- Filters applied: ${filterSummary.filtersApplied.join(', ')}`);
  } else {
    console.log('- No filters applied');
  }
  
  console.log(`- Showing ${filterSummary.filteredCommits} out of ${filterSummary.totalCommits} commits (${filterSummary.percentageKept}%)`);
  console.log(chalk.bold('──────────────────────────────────────────────'));
  
  // Display metrics
  if (metrics.totalCommits > 0) {
    console.log(chalk.blue('Metrics:'));
    
    // Date range
    if (metrics.earliestDate && metrics.latestDate) {
      console.log(`- Date range: ${formatDate(metrics.earliestDate)} to ${formatDate(metrics.latestDate)}`);
    }
    
    // Churn metrics
    console.log(`- Total churn: ${metrics.totalChurn}`);
    console.log(`- Average churn per commit: ${metrics.avgChurn}`);
    
    // Risk distribution
    console.log(`- High risk commits: ${metrics.highRiskCommits} (${Math.round((metrics.highRiskCommits / metrics.totalCommits) * 100)}%)`);
    console.log(`- Medium risk commits: ${metrics.mediumRiskCommits} (${Math.round((metrics.mediumRiskCommits / metrics.totalCommits) * 100)}%)`);
    console.log(`- Low risk commits: ${metrics.lowRiskCommits} (${Math.round((metrics.lowRiskCommits / metrics.totalCommits) * 100)}%)`);
    console.log(`- No risk commits: ${metrics.noRiskCommits} (${Math.round((metrics.noRiskCommits / metrics.totalCommits) * 100)}%)`);
    
    // PR metrics
    console.log(`- Commits with PRs: ${metrics.commitsWithPRs} (${Math.round((metrics.commitsWithPRs / metrics.totalCommits) * 100)}%)`);
    
    // Author metrics (top 3)
    console.log('- Top authors:');
    metrics.authors.slice(0, 3).forEach(author => {
      console.log(`  - ${author.name}: ${author.count} commits (${author.percentage}%)`);
    });
    
    console.log(chalk.bold('──────────────────────────────────────────────'));
  }
  
  // Display filtered commits (limit to 15 for readability)
  console.log(chalk.blue('Filtered Commits:'));
  console.log(`${chalk.bold('Hash')}        ${chalk.bold('Date')}       ${chalk.bold('Author')}      ${chalk.bold('Message')}                  ${chalk.bold('Churn')}        ${chalk.bold('PR')}`);
  
  // Sort by date (newest first)
  const sortedCommits = [...filteredCommits].sort((a, b) => new Date(b.date) - new Date(a.date));
  const commitsToShow = sortedCommits.slice(0, 15);
  
  commitsToShow.forEach(commit => {
    // Format date
    const date = formatDate(commit.date);
    
    // Format message (truncate if needed)
    const message = commit.message.length > 20 
      ? commit.message.substring(0, 17) + '...' 
      : commit.message;
    
    // Format churn with color based on risk level
    let churnText = formatChurnMetrics(commit);
    let churnColor;
    
    switch (commit.risk) {
      case 'high': churnColor = chalk.red; break;
      case 'medium': churnColor = chalk.yellow; break;
      case 'low': churnColor = chalk.green; break;
      case 'none': 
      default: churnColor = chalk.white;
    }
    
    // Format PR info
    let prInfo = '';
    if (commit.pr) {
      prInfo = chalk.cyan(`PR #${commit.pr.number}`);
    }
    
    // Pad strings for alignment
    const hashPad = ' '.repeat(Math.max(1, 13 - commit.hash.slice(0, 7).length));
    const datePad = ' '.repeat(Math.max(1, 12 - date.length));
    const authorPad = ' '.repeat(Math.max(1, 12 - commit.author.length));
    const messagePad = ' '.repeat(Math.max(1, 25 - message.length));
    
    // Print row
    console.log(
      chalk.white(commit.hash.slice(0, 7)) + hashPad +
      chalk.white(date) + datePad +
      chalk.yellow(commit.author) + authorPad +
      message + messagePad +
      churnColor(churnText) + ' ' +
      prInfo
    );
  });
  
  // Show number of total results
  if (filteredCommits.length > commitsToShow.length) {
    console.log(`\n... and ${filteredCommits.length - commitsToShow.length} more commits`);
  }
  
  console.log(chalk.bold('──────────────────────────────────────────────'));
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    console.log('Reading graph data...');
    const graphData = readGraphData();
    
    if (Object.keys(graphData).length === 0) {
      console.error('Error: graph.json is empty or not found.');
      process.exit(1);
    }
    
    console.log('Processing commit data...');
    const commits = processGraphData(graphData);
    
    // Extract filter options from command line args
    const filters = {
      author: argv.author,
      from: argv.from,
      to: argv.to,
      risk: argv.risk,
      minChurn: argv.minChurn,
      hasPr: argv.hasPr
    };
    
    // Apply filters
    console.log('Applying filters...');
    const { filteredCommits, filterSummary } = filterCommits(commits, filters);
    
    if (filteredCommits.length === 0) {
      console.log('No commits match the specified filters.');
      process.exit(0);
    }
    
    // Generate metrics
    console.log('Generating metrics...');
    const metrics = generateMetrics(filteredCommits);
    
    // Generate visualization
    console.log('Creating visualization...');
    generateFilteredVisualization(commits, filteredCommits, filterSummary, metrics, argv.output);
    
    // Export filtered data to JSON if requested
    if (argv.json) {
      console.log('Exporting filtered data to JSON...');
      exportFilteredJSON(filteredCommits, argv.json);
    }
    
    // Display filtered commits in console
    await displayFilteredCommits(filteredCommits, filterSummary, metrics);
    
    console.log('\nFiltering complete!');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
