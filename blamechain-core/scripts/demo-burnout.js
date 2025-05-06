#!/usr/bin/env node

/**
 * Demo Burnout Analysis Script
 * 
 * This script generates synthetic commit data to demonstrate the burnout analysis features.
 * It creates commit patterns that show different work habits, including:
 * - Off-hours work (late night commits)
 * - Weekend work
 * - Multiple authors with different patterns
 * 
 * It then analyzes this data using the burnoutInsights module and generates a report.
 * 
 * Usage:
 *   node demo-burnout.js [options]
 * 
 * Options:
 *   --output, -o      Output Markdown file path       [default: "../output/reports/demo-burnout-report.md"]
 *   --json            Export data to JSON file        [string]
 *   --verbose, -v     Show detailed output            [boolean]
 */

// Import required modules
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
require('dotenv').config();

// Import the burnout insights module
const {
  analyzeBurnoutRisk,
  generateBurnoutReport,
  BURNOUT_CONSTANTS
} = require('../src/metrics/burnoutInsights');

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

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('output', {
    alias: 'o',
    description: 'Output Markdown file path',
    type: 'string',
    default: '../output/reports/demo-burnout-report.md'
  })
  .option('json', {
    description: 'Export analysis data to JSON file',
    type: 'string'
  })
  .option('verbose', {
    alias: 'v',
    description: 'Show detailed output',
    type: 'boolean',
    default: false
  })
  .help()
  .alias('help', 'h')
  .argv;

/**
 * Generate a random date within a specified range
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Date} - Random date within the range
 */
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Generate a random hash string
 * @param {number} length - Length of hash
 * @returns {string} - Random hash
 */
function generateRandomHash(length = 40) {
  const characters = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Set specific time on a date
 * @param {Date} date - Date to modify
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @returns {Date} - Modified date
 */
function setTime(date, hours, minutes = 0) {
  const newDate = new Date(date);
  newDate.setHours(hours, minutes, 0, 0);
  return newDate;
}

/**
 * Generate synthetic commit data with patterns
 * @returns {Array} - Array of commit objects
 */
function generateSyntheticCommits() {
  const commits = [];
  const startDate = new Date('2024-12-01');
  const endDate = new Date('2025-04-30');
  
  // Author patterns
  const authors = {
    // High risk author - many late night and weekend commits
    'night.owl': {
      count: 30,
      hourRanges: [
        { start: 22, end: 2, weight: 0.7 },  // 70% late night
        { start: 9, end: 17, weight: 0.3 }   // 30% normal hours
      ],
      weekendProbability: 0.4
    },
    // Medium risk author - some late night work, occasional weekends
    'busy.coder': {
      count: 25,
      hourRanges: [
        { start: 9, end: 18, weight: 0.7 },   // 70% normal hours
        { start: 19, end: 23, weight: 0.3 }   // 30% evening
      ],
      weekendProbability: 0.2
    },
    // Low risk author - mostly normal hours, rare weekend
    'balanced.dev': {
      count: 20,
      hourRanges: [
        { start: 9, end: 17, weight: 0.9 },   // 90% normal hours
        { start: 18, end: 20, weight: 0.1 }   // 10% early evening
      ],
      weekendProbability: 0.05
    }
  };
  
  // Generate commits for each author
  Object.entries(authors).forEach(([author, pattern]) => {
    for (let i = 0; i < pattern.count; i++) {
      // Generate random date
      let date = randomDate(startDate, endDate);
      
      // Decide if this will be a weekend commit
      const isWeekend = Math.random() < pattern.weekendProbability;
      
      // If it should be a weekend but isn't, or vice versa, adjust the day
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      const currentlyWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (isWeekend && !currentlyWeekend) {
        // Make it a weekend - shift to Saturday
        date = new Date(date.setDate(date.getDate() + (6 - dayOfWeek)));
      } else if (!isWeekend && currentlyWeekend) {
        // Make it a weekday - shift to Monday
        const daysToAdd = dayOfWeek === 0 ? 1 : 2; // Sunday -> Monday (1), Saturday -> Monday (2)
        date = new Date(date.setDate(date.getDate() + daysToAdd));
      }
      
      // Determine hour range for this commit
      const hourRangeIndex = Math.random() < pattern.hourRanges[0].weight ? 0 : 1;
      const hourRange = pattern.hourRanges[hourRangeIndex];
      
      // Generate a random hour within the selected range
      let hour;
      if (hourRange.start <= hourRange.end) {
        // Simple range (e.g., 9-17)
        hour = Math.floor(Math.random() * (hourRange.end - hourRange.start + 1)) + hourRange.start;
      } else {
        // Overnight range (e.g., 22-2)
        const totalHours = (24 - hourRange.start) + hourRange.end;
        hour = (Math.floor(Math.random() * totalHours) + hourRange.start) % 24;
      }
      
      // Set the hour
      date = setTime(date, hour, Math.floor(Math.random() * 60));
      
      // Generate commit
      commits.push({
        hash: generateRandomHash(),
        author,
        date: date.toISOString(),
        message: `Update code for feature ${Math.floor(Math.random() * 20) + 1}`,
        insertions: Math.floor(Math.random() * 50),
        deletions: Math.floor(Math.random() * 30)
      });
    }
  });
  
  // Sort commits by date
  return commits.sort((a, b) => new Date(a.date) - new Date(b.date));
}

/**
 * Display burnout analysis results in the console
 * @param {Object} analysis - Burnout analysis results
 */
async function displayAnalysisResults(analysis) {
  // Ensure chalk is set up
  await setupChalk();
  
  const { insights, highRiskAuthors, mediumRiskAuthors, lowRiskAuthors } = analysis;
  const { teamInsights } = insights;
  
  console.log(chalk.bold.blue('\nDemo Burnout Risk Analysis Results'));
  console.log(chalk.bold('───────────────────────────────────────'));
  
  console.log(chalk.cyan('This analysis is based on synthetic data designed to demonstrate burnout detection features.'));
  console.log(chalk.cyan('The data contains patterns of:'));
  console.log('- Late night commits (10PM-6AM)');
  console.log('- Weekend work');
  console.log('- Different author patterns\n');
  
  // Display summary
  console.log(chalk.cyan.bold('Summary:'));
  console.log(`- Contributors analyzed: ${chalk.white(teamInsights.analyzedAuthors)} of ${teamInsights.totalAuthors}`);
  
  // Display risk breakdown
  if (teamInsights.highRiskAuthors > 0) {
    console.log(`- ${chalk.red.bold('High risk')} contributors: ${chalk.red(teamInsights.highRiskAuthors)}`);
  } else {
    console.log(`- High risk contributors: ${chalk.green('0')}`);
  }
  
  if (teamInsights.mediumRiskAuthors > 0) {
    console.log(`- ${chalk.yellow.bold('Medium risk')} contributors: ${chalk.yellow(teamInsights.mediumRiskAuthors)}`);
  } else {
    console.log(`- Medium risk contributors: ${chalk.green('0')}`);
  }
  
  console.log(`- ${chalk.green.bold('Low risk')} contributors: ${chalk.green(teamInsights.lowRiskAuthors)}`);
  
  // Display team metrics
  if (teamInsights.offHoursPercentage > 0) {
    const offHoursPercentFormatted = (teamInsights.offHoursPercentage * 100).toFixed(1);
    const offHoursColor = teamInsights.offHoursPercentage > 0.3 ? chalk.red : 
                         teamInsights.offHoursPercentage > 0.15 ? chalk.yellow : chalk.white;
    
    console.log(`- Off-hours commits: ${offHoursColor(offHoursPercentFormatted + '%')} of all activity`);
  }
  
  if (teamInsights.weekendPercentage > 0) {
    const weekendPercentFormatted = (teamInsights.weekendPercentage * 100).toFixed(1);
    const weekendColor = teamInsights.weekendPercentage > 0.4 ? chalk.red : 
                        teamInsights.weekendPercentage > 0.2 ? chalk.yellow : chalk.white;
    
    console.log(`- Weekend commits: ${weekendColor(weekendPercentFormatted + '%')} of all activity`);
  }
  
  // Display top patterns
  if (teamInsights.topPatterns && teamInsights.topPatterns.length > 0) {
    console.log('\n' + chalk.cyan.bold('Top Concerning Patterns:'));
    
    teamInsights.topPatterns.forEach(pattern => {
      const patternColor = pattern.percentage > 50 ? chalk.red : 
                         pattern.percentage > 30 ? chalk.yellow : chalk.white;
      
      console.log(`- ${patternColor(formatPatternType(pattern.type))}: Affects ${pattern.count} contributors (${pattern.percentage}%)`);
    });
  }
  
  // Display authors by risk
  console.log('\n' + chalk.cyan.bold('Contributors by Risk Level:'));
  
  if (highRiskAuthors.length > 0) {
    console.log(chalk.red.bold('High Risk:'));
    highRiskAuthors.forEach(author => {
      const authorData = insights.authorInsights[author];
      const riskPercent = (authorData.burnoutRiskScore * 100).toFixed(1);
      console.log(`- ${chalk.white(author)} (Risk: ${chalk.red(riskPercent + '%')})`);
      
      if (authorData.concerningPatterns && authorData.concerningPatterns.length > 0) {
        const pattern = authorData.concerningPatterns[0];
        console.log(`  ${chalk.gray('└─')} ${pattern.description}`);
      }
    });
  }
  
  if (mediumRiskAuthors.length > 0) {
    console.log(chalk.yellow.bold('Medium Risk:'));
    mediumRiskAuthors.forEach(author => {
      const authorData = insights.authorInsights[author];
      const riskPercent = (authorData.burnoutRiskScore * 100).toFixed(1);
      console.log(`- ${chalk.white(author)} (Risk: ${chalk.yellow(riskPercent + '%')})`);
    });
  }
  
  if (lowRiskAuthors.length > 0) {
    console.log(chalk.green.bold('Low Risk:'));
    lowRiskAuthors.forEach(author => {
      const authorData = insights.authorInsights[author];
      const riskPercent = (authorData.burnoutRiskScore * 100).toFixed(1);
      console.log(`- ${chalk.white(author)} (Risk: ${chalk.green(riskPercent + '%')})`);
    });
  }
  
  console.log(chalk.bold('\nFull report written to: ') + chalk.green(argv.output));
}

/**
 * Format a pattern type for display
 * @param {string} patternType - Pattern type identifier
 * @returns {string} - Human-readable pattern name
 */
function formatPatternType(patternType) {
  const patternMap = {
    'high-off-hours': 'Off-hours work',
    'high-weekend': 'Weekend work',
    'inconsistent-hours': 'Inconsistent hours',
    'poor-work-life-separation': 'Poor work-life balance',
    'late-night-concentration': 'Late night work'
  };
  
  return patternMap[patternType] || patternType;
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    console.log('Generating synthetic commit data...');
    const commits = generateSyntheticCommits();
    
    console.log(`Generated ${commits.length} synthetic commits for ${Object.keys(commits.reduce((acc, c) => { acc[c.author] = true; return acc; }, {})).length} authors.`);
    
    if (argv.verbose) {
      console.log('Generated commit details:');
      console.log(`- night.owl: Primarily late night commits (10PM-2AM) with 40% weekend work`);
      console.log(`- busy.coder: Mix of normal and evening hours with 20% weekend work`);
      console.log(`- balanced.dev: Mostly normal working hours with minimal weekend activity`);
    }
    
    // Run burnout risk analysis
    console.log('Analyzing synthetic commits for burnout patterns...');
    const analysis = analyzeBurnoutRisk(commits);
    
    // Generate report
    const report = generateBurnoutReport(analysis);
    fs.writeFileSync(argv.output, report);
    console.log(`Report generated: ${argv.output}`);
    
    // Export JSON data if requested
    if (argv.json) {
      fs.writeFileSync(argv.json, JSON.stringify(analysis, null, 2));
      console.log(`Analysis data exported to: ${argv.json}`);
    }
    
    // Display results in console
    await displayAnalysisResults(analysis);
    
    // Show additional information in verbose mode
    if (argv.verbose) {
      console.log('\nAnalysis Details:');
      console.log(`- Off-hours defined as: 10PM-6AM`);
      console.log(`- Weekend days: Saturday and Sunday`);
      console.log(`- High risk threshold: ${BURNOUT_CONSTANTS.HIGH_RISK_THRESHOLD * 100}%`);
      console.log(`- Medium risk threshold: ${BURNOUT_CONSTANTS.MEDIUM_RISK_THRESHOLD * 100}%`);
      
      // Display commit count by author
      const authorCommitCounts = commits.reduce((counts, commit) => {
        counts[commit.author] = (counts[commit.author] || 0) + 1;
        return counts;
      }, {});
      
      console.log('\nCommit Counts by Author:');
      Object.entries(authorCommitCounts).forEach(([author, count]) => {
        console.log(`- ${author}: ${count} commits`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (argv.verbose) {
      console.error(error.stack);
    }
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
