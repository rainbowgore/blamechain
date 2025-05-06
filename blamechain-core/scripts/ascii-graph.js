#!/usr/bin/env node

/**
 * ASCII Graph Renderer for Blamechain
 * 
 * This script generates an ASCII representation of the commit graph, showing
 * commit history and relationships with color-coding based on risk factors.
 * 
 * Usage:
 *   node ascii-graph.js [options]
 * 
 * Options:
 *   --input, -i     Path to graph.json           [default: "../output/data/graph.json"]
 *   --mode, -m      Display mode (basic|detailed)[default: "basic"]
 *   --width, -w     Maximum width for output     [default: 80]
 *   --color, -c     Enable/disable color         [default: true]
 *   --branch, -b    Show branch lines            [default: true]
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Import chalk dynamically since it's ESM
async function setupChalk() {
  try {
    return (await import('chalk')).default;
  } catch (error) {
    // Fallback if chalk can't be loaded
    console.warn('Could not load chalk for colored output. Using plain text instead.');
    return {
      red: text => text,
      yellow: text => text,
      green: text => text,
      blue: text => text,
      cyan: text => text,
      gray: text => text,
      white: text => text,
      bold: {
        red: text => text,
        yellow: text => text,
        blue: text => text,
        green: text => text,
        cyan: text => text
      }
    };
  }
}

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .option('input', {
    alias: 'i',
    description: 'Path to graph.json',
    type: 'string',
    default: '../output/data/graph.json'
  })
  .option('mode', {
    alias: 'm',
    description: 'Display mode (basic|detailed)',
    type: 'string',
    default: 'basic',
    choices: ['basic', 'detailed']
  })
  .option('width', {
    alias: 'w',
    description: 'Maximum width for output',
    type: 'number',
    default: 80
  })
  .option('color', {
    alias: 'c',
    description: 'Enable/disable color',
    type: 'boolean',
    default: true
  })
  .option('branch', {
    alias: 'b',
    description: 'Show branch lines',
    type: 'boolean',
    default: true
  })
  .help()
  .alias('help', 'h')
  .version(false)
  .argv;

// Constants for risk thresholds (matching the existing ones in the project)
const HIGH_CHURN_THRESHOLD = 500;
const MEDIUM_CHURN_THRESHOLD = 200;

// ASCII characters for graph rendering
const GRAPH_CHARS = {
  VERTICAL: '│',
  HORIZONTAL: '─',
  CROSS: '┼',
  DOWN_RIGHT: '┌',
  DOWN_LEFT: '┐',
  UP_RIGHT: '└',
  UP_LEFT: '┘',
  VERTICAL_RIGHT: '├',
  VERTICAL_LEFT: '┤',
  COMMIT: '●',
  SPACE: ' '
};

/**
 * Calculate the risk level of a commit based on churn metrics
 * @param {Object} data - Commit data
 * @returns {string} - Risk level (high, medium, low)
 */
function calculateRiskLevel(data) {
  const insertions = data.insertions || 0;
  const deletions = data.deletions || 0;
  const churn = data.churn || (insertions + deletions);
  
  if (churn >= HIGH_CHURN_THRESHOLD) return 'high';
  if (churn >= MEDIUM_CHURN_THRESHOLD) return 'medium';
  return 'low';
}

/**
 * Format churn metrics as a string
 * @param {Object} data - Commit data
 * @returns {string} - Formatted churn string
 */
function formatChurnMetrics(data) {
  if (!data.insertions && !data.deletions && !data.churn) return '';
  
  const insertions = data.insertions || 0;
  const deletions = data.deletions || 0;
  const churn = data.churn || (insertions + deletions);
  
  return `[+${insertions}/-${deletions}, churn: ${churn}]`;
}

/**
 * Process the commit graph to calculate relationships and order
 * @param {Object} graph - The commit graph from graph.json
 * @returns {Array} - Sorted array of commits with ancestor information
 */
function processGraph(graph) {
  // First, make sure we have parent-child relationships in the graph
  const graphWithRelationships = addRelationshipsToGraph(graph);
  
  // Create a sorted array of commits (newest first)
  const sortedCommits = Object.entries(graphWithRelationships)
    .map(([hash, data]) => ({ hash, ...data }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Add level and column info for rendering
  return calculateGraphLayout(sortedCommits);
}

/**
 * Add parent-child relationships to the graph if they don't exist
 * @param {Object} graph - The commit graph from graph.json
 * @returns {Object} - Graph with parent-child relationships
 */
function addRelationshipsToGraph(graph) {
  const enhancedGraph = JSON.parse(JSON.stringify(graph));
  
  // Initialize parents/children arrays if they don't exist
  Object.keys(enhancedGraph).forEach(hash => {
    if (!enhancedGraph[hash].parents) enhancedGraph[hash].parents = [];
    if (!enhancedGraph[hash].children) enhancedGraph[hash].children = [];
  });
  
  // Fill in parent-child relationships based on existing children arrays
  Object.entries(enhancedGraph).forEach(([hash, data]) => {
    if (data.children && data.children.length > 0) {
      data.children.forEach(childHash => {
        if (enhancedGraph[childHash] && 
            !enhancedGraph[childHash].parents.includes(hash)) {
          enhancedGraph[childHash].parents.push(hash);
        }
      });
    }
  });
  
  // Fill in child relationships based on parent arrays
  Object.entries(enhancedGraph).forEach(([hash, data]) => {
    if (data.parents && data.parents.length > 0) {
      data.parents.forEach(parentHash => {
        if (enhancedGraph[parentHash] && 
            !enhancedGraph[parentHash].children.includes(hash)) {
          enhancedGraph[parentHash].children.push(hash);
        }
      });
    }
  });
  
  return enhancedGraph;
}

/**
 * Calculate layout information for the graph visualization
 * @param {Array} commits - Sorted array of commits
 * @returns {Array} - Commits with layout information
 */
function calculateGraphLayout(commits) {
  // Create a map of hash to index for quick lookup
  const hashIndex = {};
  commits.forEach((commit, i) => {
    hashIndex[commit.hash] = i;
    commit.column = 0; // default column
  });
  
  // Current active branches (columns)
  const activeBranches = [];
  let maxColumn = 0;
  
  // Calculate columns for each commit
  commits.forEach((commit, i) => {
    // Check if this commit is a merge (has multiple parents)
    const isMerge = commit.parents && commit.parents.length > 1;
    
    // Commit is part of an existing branch
    if (i > 0 && commit.parents && commit.parents.length > 0) {
      // Find if any parent is in active branches
      let foundParent = false;
      for (const parentHash of commit.parents) {
        const parentIndex = hashIndex[parentHash];
        
        // Only process known parents in our dataset
        if (parentIndex !== undefined) {
          const parentCommit = commits[parentIndex];
          
          // If parent already has a column, use that column if possible
          if (parentCommit.column !== undefined) {
            if (!foundParent || isMerge) {
              // For the first parent or in merge commits, try to reuse the column
              if (!activeBranches.includes(parentCommit.column)) {
                activeBranches.push(parentCommit.column);
              }
              
              if (!foundParent) {
                commit.column = parentCommit.column;
                foundParent = true;
              }
            }
          }
        }
      }
      
      // If no parent column found or it's a merge, assign new column
      if (!foundParent) {
        commit.column = maxColumn++;
        activeBranches.push(commit.column);
      }
    } else {
      // New branch, assign next column
      commit.column = maxColumn++;
      activeBranches.push(commit.column);
    }
    
    // Update max column if needed
    maxColumn = Math.max(maxColumn, commit.column + 1);
  });
  
  return commits;
}

/**
 * Render the ASCII graph
 * @param {Array} commits - Processed commits with layout information
 * @param {Object} options - Rendering options
 * @param {Object} chalk - Chalk instance for colors
 * @returns {string} - ASCII representation of the graph
 */
function renderAsciiGraph(commits, options, chalk) {
  const lines = [];
  const isDetailed = options.mode === 'detailed';
  const maxWidth = options.width || 80;
  const showBranches = options.branch;
  
  // Function to get the appropriate color based on risk level
  const getRiskColor = (commit) => {
    const risk = calculateRiskLevel(commit);
    if (!options.color) return val => val;
    
    switch (risk) {
      case 'high': return chalk.red;
      case 'medium': return chalk.yellow;
      case 'low': return chalk.green;
      default: return chalk.white;
    }
  };
  
  // Create header
  const header = '  ' + chalk.bold.cyan('Commit') + 
                 '  ' + chalk.bold.cyan('Author') + 
                 '  ' + chalk.bold.cyan('Date') + 
                 '  ' + chalk.bold.cyan('Message');
  lines.push(header);
  
  const separator = '  ' + '─'.repeat(maxWidth - 4);
  lines.push(separator);
  
  // Render each commit
  commits.forEach((commit, i) => {
    const color = getRiskColor(commit);
    const column = commit.column || 0;
    
    // Build branch lines
    let branchStr = '';
    if (showBranches) {
      // Create fixed-width branch representation
      const numColumns = Math.max(...commits.map(c => c.column || 0)) + 1;
      const branchChars = Array(numColumns).fill(' ');
      
      // Add commit marker in the appropriate column
      branchChars[column] = GRAPH_CHARS.COMMIT;
      
      // Add lines to parents (next commits in list that are parents of this one)
      const parentsInNextRows = [];
      
      if (commit.parents) {
        commit.parents.forEach(parentHash => {
          const parentIndex = commits.findIndex(c => c.hash === parentHash);
          if (parentIndex > i) { // Parent is below in our list
            const parentColumn = commits[parentIndex].column || 0;
            parentsInNextRows.push(parentColumn);
            
            // Draw connection to this parent
            if (parentColumn !== column) {
              // Horizontal line to parent
              for (let c = Math.min(column, parentColumn) + 1; c < Math.max(column, parentColumn); c++) {
                branchChars[c] = GRAPH_CHARS.HORIZONTAL;
              }
              
              // Add corners
              if (parentColumn > column) {
                branchChars[column] = GRAPH_CHARS.VERTICAL_RIGHT;
                branchChars[parentColumn] = GRAPH_CHARS.VERTICAL_LEFT;
              } else {
                branchChars[column] = GRAPH_CHARS.VERTICAL_LEFT;
                branchChars[parentColumn] = GRAPH_CHARS.VERTICAL_RIGHT;
              }
            }
          }
        });
      }
      
      // Add vertical lines for branches that continue
      for (let c = 0; c < numColumns; c++) {
        if (branchChars[c] === ' ' && parentsInNextRows.includes(c)) {
          branchChars[c] = GRAPH_CHARS.VERTICAL;
        }
      }
      
      branchStr = branchChars.join('');
    } else {
      // Simple branch marker if branch lines are disabled
      branchStr = GRAPH_CHARS.COMMIT + ' ';
    }
    
    // Format the commit basic info
    const hash = commit.hash.substring(0, 7);
    const author = commit.author || 'Unknown';
    const date = new Date(commit.date).toISOString().split('T')[0];
    const message = commit.message || '';
    
    // Format churn metrics if in detailed mode
    const churnMetrics = isDetailed ? formatChurnMetrics(commit) : '';
    
    // Combine into a line
    const basicInfo = `${color(hash)} ${author.padEnd(15).substring(0, 15)} ${date} ${message.substring(0, 40)}`;
    const line = `${branchStr} ${basicInfo}${isDetailed ? ' ' + chalk.gray(churnMetrics) : ''}`;
    
    lines.push(line);
    
    // Add extra details if in detailed mode
    if (isDetailed) {
      const insertions = commit.insertions || 0;
      const deletions = commit.deletions || 0;
      const churn = commit.churn || (insertions + deletions);
      
      if (insertions > 0 || deletions > 0 || churn > 0) {
        const detailLine = ' '.repeat(branchStr.length + 2) + 
                         chalk.green(`+${insertions}`) + ' ' +
                         chalk.red(`-${deletions}`) + ' ' +
                         chalk.blue(`Churn: ${churn}`);
        lines.push(detailLine);
      }
      
      // If it has PR info, show that in detailed mode
      if (commit.pr) {
        const prInfo = ` PR #${commit.pr.number || 'Unknown'} (${commit.pr.state || 'unknown'})`;
        const prLine = ' '.repeat(branchStr.length + 2) + chalk.blue(prInfo);
        lines.push(prLine);
      }
      
      // Add a small separator after detailed commit info
      lines.push(' '.repeat(branchStr.length));
    }
  });
  
  return lines.join('\n');
}

/**
 * Read graph data from JSON file
 * @param {string} inputPath - Path to the graph.json file
 * @returns {Object} - The graph data object or null if error
 */
function readGraphData(inputPath) {
  try {
    const data = fs.readFileSync(inputPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading graph data from ${inputPath}: ${error.message}`);
    return null;
  }
}

/**
 * Main function to run the script
 */
async function main() {
  try {
    // Set up chalk for colored output
    const chalk = await setupChalk();
    
    // Read the graph data
    console.log(`Reading graph data from ${argv.input}...`);
    const graphData = readGraphData(argv.input);
    
    if (!graphData) {
      console.error('Error: Failed to read graph data.');
      process.exit(1);
    }
    
    // Get commit count
    const commitCount = Object.keys(graphData).length;
    console.log(`Found ${commitCount} commits in the graph.`);
    
    if (commitCount === 0) {
      console.warn('Warning: No commits found in the graph data.');
      process.exit(0);
    }
    
    // Process the graph data
    console.log('Processing commit graph...');
    const processedCommits = processGraph(graphData);
    
    // Render the ASCII graph
    console.log(`Rendering ASCII graph (${argv.mode} mode)...`);
    const asciiGraph = renderAsciiGraph(processedCommits, {
      mode: argv.mode,
      width: argv.width,
      color: argv.color,
      branch: argv.branch
    }, chalk);
    
    // Print the ASCII graph
    console.log('\n' + asciiGraph);
    
    // Show render options
    console.log('\nRender options:');
    console.log(`- Mode: ${argv.mode}`);
    console.log(`- Color: ${argv.color ? 'enabled' : 'disabled'}`);
    console.log(`- Branch lines: ${argv.branch ? 'enabled' : 'disabled'}`);
    console.log(`- Max width: ${argv.width} characters`);
    
    // Print help message
    console.log('\nTip: Use different modes for more or less detail:');
    console.log('  --mode detailed    Show detailed commit info including churn metrics');
    console.log('  --mode basic       Show basic commit info (default)');
    
  } catch (error) {
    console.error('Error rendering ASCII graph:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the main function if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

// Export functions for potential use as a module
module.exports = {
  renderAsciiGraph,
  processGraph,
  calculateRiskLevel,
  formatChurnMetrics
};

