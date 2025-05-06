const fs = require('fs');
const { createCanvas } = require('canvas');

// Constants for risk thresholds
const HIGH_CHURN_THRESHOLD = 500;
const HIGH_AVG_CHURN_THRESHOLD = 50;
const MEDIUM_CHURN_THRESHOLD = 200;
const MEDIUM_AVG_CHURN_THRESHOLD = 20;

// Colors for risk levels
const COLORS = {
  HIGH_RISK: '#FF3A33', // Red
  MEDIUM_RISK: '#FFA500', // Orange
  LOW_RISK: '#000000', // Black
  PR_INDICATOR: '#4A86E8', // Blue
  PR_MERGED: '#6AA84F', // Green
  PR_CLOSED: '#999999', // Gray
  BACKGROUND: '#FFFFFF', // White
  CHURN_POSITIVE: '#6AA84F', // Green for insertions
  CHURN_NEGATIVE: '#FF3A33', // Red for deletions
};

/**
 * Calculate the risk level of a commit based on churn metrics
 * @param {Object} data - Commit data
 * @returns {string} - Risk level color
 */
function calculateRiskColor(data) {
  const insertions = data.insertions || 0;
  const deletions = data.deletions || 0;
  const churn = data.churn || (insertions + deletions);
  
  // Default to low risk if no churn data
  if (!churn && churn !== 0) return COLORS.LOW_RISK;
  
  // Determine risk level based on churn thresholds
  if (churn >= HIGH_CHURN_THRESHOLD) return COLORS.HIGH_RISK;
  if (churn >= MEDIUM_CHURN_THRESHOLD) return COLORS.MEDIUM_RISK;
  
  return COLORS.LOW_RISK;
}

/**
 * Format churn metrics for display in the PNG
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
 * Format PR information for display in the PNG
 * @param {Object} data - Commit data
 * @returns {string} - Formatted PR string
 */
function formatPRInfo(data) {
  if (!data.pr) return '';
  
  const prNumber = data.pr.number;
  const prState = data.pr.state || 'unknown';
  const reviewerCount = data.pr.stats?.reviewer_count || 0;
  const isStale = data.pr.stats?.is_stale || false;
  
  let prInfo = `PR #${prNumber}`;
  
  if (reviewerCount > 0) {
    prInfo += ` (${reviewerCount} reviewer${reviewerCount !== 1 ? 's' : ''})`;
  }
  
  if (isStale) {
    prInfo += ' [STALE]';
  }
  
  return prInfo;
}

/**
 * Get the color for PR state
 * @param {Object} data - Commit data
 * @returns {string} - Color for PR state
 */
function getPRStateColor(data) {
  if (!data.pr) return null;
  
  const prState = data.pr.state || 'unknown';
  const mergedAt = data.pr.merged_at;
  
  if (mergedAt) return COLORS.PR_MERGED;
  if (prState === 'closed') return COLORS.PR_CLOSED;
  return COLORS.PR_INDICATOR;
}

/**
 * Export the graph data to a JSON file
 * @param {Object} graph - Graph data
 * @param {string} filePath - Path to save the JSON file
 */
function exportGraphJSON(graph, filePath = 'graph.json') {
  fs.writeFileSync(filePath, JSON.stringify(graph, null, 2));
  console.log(`Graph JSON exported to ${filePath}`);
}

/**
 * Export the graph data to a PNG image with enhanced visualizations
 * @param {Object} graph - Graph data
 * @param {string} filePath - Path to save the PNG file
 */
function exportGraphPNG(graph, filePath = 'graph.png') {
  // Get number of commits to calculate canvas height
  const commitCount = Object.keys(graph).length;
  const rowHeight = 30; // Height for each commit row
  const padding = 40; // Padding for the canvas
  const canvasWidth = 1000; // Width of the canvas
  const canvasHeight = Math.max(400, commitCount * rowHeight + padding * 2); // Dynamic height based on commit count
  
  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  
  // Draw background
  ctx.fillStyle = COLORS.BACKGROUND;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Add title and legend
  ctx.font = 'bold 16px Arial';
  ctx.fillStyle = '#000000';
  ctx.fillText('Commit Graph with Churn Metrics', padding, padding - 10);
  
  // Add legend
  const legendY = padding + 10;
  const legendGap = 20;
  
  // High risk legend
  ctx.fillStyle = COLORS.HIGH_RISK;
  ctx.fillRect(padding, legendY, 15, 15);
  ctx.fillStyle = '#000000';
  ctx.font = '12px Arial';
  ctx.fillText(`High Risk (Churn ≥ ${HIGH_CHURN_THRESHOLD})`, padding + 20, legendY + 12);
  
  // Medium risk legend
  ctx.fillStyle = COLORS.MEDIUM_RISK;
  ctx.fillRect(padding + 200, legendY, 15, 15);
  ctx.fillStyle = '#000000';
  ctx.fillText(`Medium Risk (Churn ≥ ${MEDIUM_CHURN_THRESHOLD})`, padding + 220, legendY + 12);
  
  // PR indicator legend
  ctx.fillStyle = COLORS.PR_INDICATOR;
  ctx.fillRect(padding + 450, legendY, 15, 15);
  ctx.fillStyle = '#000000';
  ctx.fillText('Has PR', padding + 470, legendY + 12);
  
  // Draw each commit with enhanced information
  ctx.font = '14px Arial';
  
  Object.entries(graph).forEach(([hash, data], i) => {
    const rowY = padding + 40 + i * rowHeight;
    const commitHashX = padding;
    const authorX = padding + 150;
    const messageX = padding + 300;
    const churnX = padding + 700;
    
    // Set color based on risk level
    const riskColor = calculateRiskColor(data);
    ctx.fillStyle = riskColor;
    
    // Draw commit hash (7 characters)
    ctx.fillText(hash.slice(0, 7), commitHashX, rowY);
    
    // Draw author
    ctx.fillText(data.author, authorX, rowY);
    
    // Draw commit message with potential PR indicator
    const message = data.message;
    const prInfo = formatPRInfo(data);
    
    if (prInfo) {
      // Draw message
      ctx.fillText(message, messageX, rowY);
      
      // Draw PR info with appropriate color
      const prColor = getPRStateColor(data) || COLORS.PR_INDICATOR;
      ctx.fillStyle = prColor;
      ctx.fillText(prInfo, messageX + ctx.measureText(message + '  ').width, rowY);
      
      // Reset color for churn metrics
      ctx.fillStyle = riskColor;
    } else {
      // Just draw the message if no PR
      ctx.fillText(message, messageX, rowY);
    }
    
    // Draw churn metrics
    const churnMetrics = formatChurnMetrics(data);
    if (churnMetrics) {
      ctx.fillText(churnMetrics, churnX, rowY);
    }
    
    // Draw separator line
    ctx.strokeStyle = '#EEEEEE';
    ctx.beginPath();
    ctx.moveTo(padding, rowY + 10);
    ctx.lineTo(canvasWidth - padding, rowY + 10);
    ctx.stroke();
  });
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);
  console.log(`Enhanced graph PNG exported to ${filePath}`);
}

module.exports = { exportGraphJSON, exportGraphPNG };
