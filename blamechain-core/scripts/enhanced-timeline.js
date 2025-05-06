#!/usr/bin/env node

/**
 * Enhanced Timeline Visualization Script
 * 
 * This script demonstrates the enhanced visualization features including:
 * - Timeline aggregation (weekly, monthly)
 * - Colored output for high-risk commits based on churn
 * - Churn metrics display in the timeline
 * 
 * Usage:
 *   node enhanced-timeline.js [options]
 * 
 * Options:
 *   --period <string>    Timeline aggregation period: daily, weekly, monthly, or custom (default: "daily")
 *   --days <number>      Number of days in custom period (default: 14)
 *   --output <string>    Output file name (default: "timeline-{period}.png")
 *   --maxItems <number>  Maximum number of items to display (default: 100)
 *   --help               Show help
 */

// Import required modules
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
require('dotenv').config();

// Import timeline functions
const { 
  buildTimeline, 
  buildWeeklyTimeline, 
  buildMonthlyTimeline, 
  buildCustomTimeline 
} = require('../src/graph/timelineBuilder');

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
    red: text => text
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

// Colors for risk levels
const COLORS = {
  HIGH_RISK: '#FF3A33', // Red
  MEDIUM_RISK: '#FFA500', // Orange
  LOW_RISK: '#4CAF50', // Green
  DEFAULT: '#000000', // Black
  BACKGROUND: '#FFFFFF', // White
  HEADINGS: '#333333', // Dark Gray
  GRID_LINES: '#EEEEEE', // Light Gray
  PR_INDICATOR: '#4A86E8', // Blue
};

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('period', {
    alias: 'p',
    description: 'Timeline aggregation period: daily, weekly, monthly, or custom',
    type: 'string',
    default: 'daily'
  })
  .option('days', {
    alias: 'd',
    description: 'Number of days in custom period',
    type: 'number',
    default: 14
  })
  .option('output', {
    alias: 'o',
    description: 'Output file name',
    type: 'string'
  })
  .option('maxItems', {
    alias: 'm',
    description: 'Maximum number of items to display',
    type: 'number',
    default: 100
  })
  .help()
  .alias('help', 'h')
  .argv;

/**
 * Get the risk color based on churn value
 * @param {number} churn - Total churn value
 * @returns {string} - Color code
 */
function getRiskColor(churn) {
  if (churn >= HIGH_CHURN_THRESHOLD) return COLORS.HIGH_RISK;
  if (churn >= MEDIUM_CHURN_THRESHOLD) return COLORS.MEDIUM_RISK;
  if (churn >= LOW_CHURN_THRESHOLD) return COLORS.LOW_RISK;
  return COLORS.DEFAULT;
}

/**
 * Format churn metrics for display
 * @param {Object} item - Timeline item with churn metrics
 * @returns {string} - Formatted churn string
 */
function formatChurnMetrics(item) {
  const insertions = item.insertions || 0;
  const deletions = item.deletions || 0;
  const churn = item.churn || 0;
  
  return `[+${insertions}/-${deletions}, churn: ${churn}]`;
}

/**
 * Format author list for display
 * @param {Array} authorList - List of authors with commit counts
 * @returns {string} - Formatted author string
 */
function formatAuthors(authorList) {
  if (!authorList || !Array.isArray(authorList)) return '';
  
  // Sort authors by commit count (highest first)
  const sortedAuthors = [...authorList].sort((a, b) => b.count - a.count);
  
  // Format each author with commit count
  return sortedAuthors.map(author => `${author.name} (${author.count})`).join(', ');
}

/**
 * Format PR numbers for display
 * @param {Array} prNumbers - List of PR numbers
 * @returns {string} - Formatted PR string
 */
function formatPRs(prNumbers) {
  if (!prNumbers || !Array.isArray(prNumbers) || prNumbers.length === 0) return '';
  
  return `PRs: ${prNumbers.join(', ')}`;
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
    related_prs: data.related_prs || []
  }));
}

/**
 * Generate timeline based on selected period
 * @param {Array} commits - Array of commit objects
 * @param {string} period - Selected period (daily, weekly, monthly, custom)
 * @param {number} customDays - Number of days for custom period
 * @returns {Array} - Timeline items
 */
function generateTimeline(commits, period, customDays) {
  switch (period.toLowerCase()) {
    case 'weekly':
      return buildWeeklyTimeline(commits);
    case 'monthly':
      return buildMonthlyTimeline(commits);
    case 'custom':
      return buildCustomTimeline(commits, customDays);
    case 'daily':
    default:
      return buildTimeline(commits);
  }
}

/**
 * Generate PNG visualization for timeline
 * @param {Array} timeline - Array of timeline items
 * @param {string} period - Selected period
 * @param {string} outputFile - Output file path
 */
function generateVisualization(timeline, period, outputFile) {
  // Limit number of items if needed
  const itemsToDisplay = timeline.slice(0, argv.maxItems);
  const itemCount = itemsToDisplay.length;
  
  // Calculate canvas dimensions
  const rowHeight = 40;
  const headerHeight = 120;
  const footerHeight = 50;
  const padding = 20;
  const canvasWidth = 1200;
  const canvasHeight = headerHeight + (rowHeight * itemCount) + footerHeight;
  
  // Create canvas
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  
  // Draw background
  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Draw title
  ctx.fillStyle = COLORS.HEADINGS;
  ctx.font = 'bold 24px Arial';
  ctx.fillText(`Commit Timeline (${period.toUpperCase()})`, padding, padding + 10);
  
  // Draw info
  ctx.font = '14px Arial';
  ctx.fillText(`Total items: ${timeline.length} (showing ${itemsToDisplay.length})`, padding, padding + 40);
  
  // Draw legend
  const legendY = padding + 70;
  const legendGap = 180;
  
  // High risk legend
  ctx.fillStyle = COLORS.HIGH_RISK;
  ctx.fillRect(padding, legendY, 15, 15);
  ctx.fillStyle = COLORS.HEADINGS;
  ctx.fillText(`High Risk (Churn ≥ ${HIGH_CHURN_THRESHOLD})`, padding + 20, legendY + 12);
  
  // Medium risk legend
  ctx.fillStyle = COLORS.MEDIUM_RISK;
  ctx.fillRect(padding + legendGap, legendY, 15, 15);
  ctx.fillStyle = COLORS.HEADINGS;
  ctx.fillText(`Medium Risk (Churn ≥ ${MEDIUM_CHURN_THRESHOLD})`, padding + legendGap + 20, legendY + 12);
  
  // Low risk legend
  ctx.fillStyle = COLORS.LOW_RISK;
  ctx.fillRect(padding + (legendGap * 2), legendY, 15, 15);
  ctx.fillStyle = COLORS.HEADINGS;
  ctx.fillText(`Low Risk (Churn ≥ ${LOW_CHURN_THRESHOLD})`, padding + (legendGap * 2) + 20, legendY + 12);
  
  // PR indicator legend
  ctx.fillStyle = COLORS.PR_INDICATOR;
  ctx.fillRect(padding + (legendGap * 3), legendY, 15, 15);
  ctx.fillStyle = COLORS.HEADINGS;
  ctx.fillText('Has PRs', padding + (legendGap * 3) + 20, legendY + 12);
  
  // Draw column headers
  ctx.fillStyle = COLORS.HEADINGS;
  ctx.font = 'bold 14px Arial';
  
  const dateX = padding;
  const authorX = padding + 250;
  const churnX = padding + 500;
  const prX = padding + 700;
  const headerY = headerHeight - 10;
  
  if (period === 'daily') {
    ctx.fillText('Date', dateX, headerY);
    ctx.fillText('Author | Message', authorX, headerY);
  } else {
    ctx.fillText('Period', dateX, headerY);
    ctx.fillText('Authors (Commits)', authorX, headerY);
  }
  
  ctx.fillText('Churn Metrics', churnX, headerY);
  ctx.fillText('PRs', prX, headerY);
  
  // Draw separator line
  ctx.strokeStyle = COLORS.HEADINGS;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, headerHeight);
  ctx.lineTo(canvasWidth - padding, headerHeight);
  ctx.stroke();
  
  // Draw timeline items
  ctx.font = '14px Arial';
  
  itemsToDisplay.forEach((item, i) => {
    const rowY = headerHeight + (i * rowHeight) + 25;
    
    // Calculate risk color based on churn
    const riskColor = getRiskColor(item.churn);
    
    // Draw date/period
    ctx.fillStyle = COLORS.HEADINGS;
    if (period === 'daily') {
      const date = new Date(item.date).toISOString().split('T')[0];
      ctx.fillText(date, dateX, rowY);
      
      // Draw author and message
      ctx.fillText(`${item.author} | ${item.message}`, authorX, rowY);
    } else {
      ctx.fillText(item.displayRange, dateX, rowY);
      
      // Draw author list
      const authorText = formatAuthors(item.authorList);
      ctx.fillText(authorText.substring(0, 40) + (authorText.length > 40 ? '...' : ''), authorX, rowY);
      
      // Draw commit count
      ctx.fillText(`(${item.commitCount} commits)`, authorX + ctx.measureText(authorText.substring(0, 40)).width + 10, rowY);
    }
    
    // Draw churn metrics with risk color
    ctx.fillStyle = riskColor;
    if (period === 'daily') {
      ctx.fillText(formatChurnMetrics(item), churnX, rowY);
    } else {
      ctx.fillText(`+${item.insertions}/-${item.deletions} (churn: ${item.churn})`, churnX, rowY);
    }
    
    // Draw PR information
    ctx.fillStyle = COLORS.PR_INDICATOR;
    if (period === 'daily') {
      if (item.pr) {
        ctx.fillText(`PR #${item.pr.number}`, prX, rowY);
      }
    } else {
      const prText = formatPRs(item.prNumbers);
      if (prText) {
        ctx.fillText(prText, prX, rowY);
      }
    }
    
    // Draw separator line
    ctx.strokeStyle = COLORS.GRID_LINES;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padding, rowY + 15);
    ctx.lineTo(canvasWidth - padding, rowY + 15);
    ctx.stroke();
  });
  
  // Write image to file
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputFile, buffer);
  console.log(`Timeline visualization exported to ${outputFile}`);
}

/**
 * Display timeline in console
 * @param {Array} timeline - Array of timeline items
 * @param {string} period - Selected period
 */
async function displayTimelineInConsole(timeline, period) {
  // Ensure chalk is set up
  await setupChalk();
  
  console.log(chalk.bold.blue(`\nCommit Timeline (${period.toUpperCase()})`));
  console.log(`Total items: ${timeline.length}`);
  
  // Limit number of items in console output
  const maxConsoleItems = Math.min(timeline.length, argv.maxItems);
  const itemsToDisplay = timeline.slice(0, maxConsoleItems);
  
  console.log(chalk.gray('─'.repeat(80)));
  
  // Display headers based on period type
  if (period === 'daily') {
    console.log(
      chalk.bold('Date') + ' '.repeat(12) + 
      chalk.bold('Author | Message') + ' '.repeat(30) + 
      chalk.bold('Churn Metrics') + ' '.repeat(10) + 
      chalk.bold('PRs')
    );
  } else {
    console.log(
      chalk.bold('Period') + ' '.repeat(22) + 
      chalk.bold('Authors (Commits)') + ' '.repeat(20) + 
      chalk.bold('Churn Metrics') + ' '.repeat(10) + 
      chalk.bold('PRs')
    );
  }
  
  console.log(chalk.gray('─'.repeat(80)));
  
  // Display each timeline item
  itemsToDisplay.forEach(item => {
    const churn = item.churn || 0;
    let churnColor;
    
    // Apply color based on risk thresholds
    if (churn >= HIGH_CHURN_THRESHOLD) {
      churnColor = chalk.red;
    } else if (churn >= MEDIUM_CHURN_THRESHOLD) {
      churnColor = chalk.yellow;
    } else if (churn >= LOW_CHURN_THRESHOLD) {
      churnColor = chalk.green;
    } else {
      churnColor = chalk.white;
    }
    
    if (period === 'daily') {
      // Format for daily view (individual commits)
      const date = new Date(item.date).toISOString().split('T')[0];
      const churnMetrics = formatChurnMetrics(item);
      
      // PR information
      let prInfo = '';
      if (item.pr) {
        prInfo = chalk.cyan(`PR #${item.pr.number}`);
      }
      
      console.log(
        chalk.white(date) + ' '.repeat(Math.max(1, 15 - date.length)) +
        chalk.yellow(item.author) + ' | ' + item.message.substring(0, 30) + ' '.repeat(Math.max(1, 35 - (item.author.length + item.message.length))) +
        churnColor(churnMetrics) + ' '.repeat(Math.max(1, 20 - churnMetrics.length)) +
        prInfo
      );
    } else {
      // Format for aggregated view (weekly, monthly, custom)
      const displayRange = item.displayRange;
      const authorText = formatAuthors(item.authorList);
      const truncatedAuthors = authorText.length > 25 ? authorText.substring(0, 22) + '...' : authorText;
      const commitCount = `(${item.commitCount} commit${item.commitCount !== 1 ? 's' : ''})`;
      const churnMetrics = `+${item.insertions}/-${item.deletions} (churn: ${item.churn})`;
      const prText = formatPRs(item.prNumbers);
      
      console.log(
        chalk.white(displayRange) + ' '.repeat(Math.max(1, 30 - displayRange.length)) +
        chalk.yellow(truncatedAuthors) + ' ' + commitCount + ' '.repeat(Math.max(1, 30 - (truncatedAuthors.length + commitCount.length))) +
        churnColor(churnMetrics) + ' '.repeat(Math.max(1, 25 - churnMetrics.length)) +
        chalk.cyan(prText)
      );
    }
  });
  
  console.log(chalk.gray('─'.repeat(80)));
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
    
    // Get the selected period and any custom days
    const period = argv.period.toLowerCase();
    const customDays = argv.days;
    
    // Generate the appropriate timeline
    console.log(`Generating ${period} timeline...`);
    const timeline = generateTimeline(commits, period, customDays);
    
    // Set default output file if not specified
    const outputFile = argv.output || `timeline-${period}.png`;
    
    // Generate visualization
    console.log('Creating visualization...');
    generateVisualization(timeline, period, outputFile);
    
    // Display timeline in console
    await displayTimelineInConsole(timeline, period);
    
    console.log(chalk.green.bold('\nVisualization complete!'));
    console.log(`PNG file: ${outputFile}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Make script executable from command line
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
