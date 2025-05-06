/**
 * Ownership Insights Module
 */

const OWNERSHIP_CONSTANTS = {
  HIGH_STABILITY_THRESHOLD: 0.8,
  MEDIUM_STABILITY_THRESHOLD: 0.5,
  RAPID_CHANGE_WINDOW_DAYS: 14,
  RAPID_CHANGE_THRESHOLD: 3,
  WEIGHTS: {
    AUTHOR_COUNT: 0.3,
    CHANGE_FREQUENCY: 0.4,
    OWNERSHIP_DURATION: 0.3
  }
};

function extractFileAuthorships(commits) {
  const fileAuthors = {};
  for (const commit of commits) {
    const { author, date, files, hash } = commit;
    if (!author || !date || !Array.isArray(files)) continue;

    for (const file of files) {
      if (!fileAuthors[file]) {
        fileAuthors[file] = {
          currentOwner: null,
          ownerHistory: [],
          commitHistory: [],
          authors: new Set()
        };
      }
      const entry = fileAuthors[file];
      entry.authors.add(author);
      entry.commitHistory.push({ hash, author, date, timestamp: new Date(date).getTime() });

      if (entry.currentOwner !== author) {
        const now = new Date(date).getTime();
        entry.ownerHistory.push({ author, startDate: date, startTimestamp: now });

        if (entry.ownerHistory.length > 1) {
          const prev = entry.ownerHistory[entry.ownerHistory.length - 2];
          prev.endDate = date;
          prev.endTimestamp = now;
          prev.durationDays = Math.round((now - prev.startTimestamp) / (1000 * 60 * 60 * 24));
        }

        entry.currentOwner = author;
      }
    }
  }

  for (const file of Object.keys(fileAuthors)) {
    fileAuthors[file].commitHistory.sort((a, b) => a.timestamp - b.timestamp);
    const current = fileAuthors[file].ownerHistory.at(-1);
    if (current) {
      current.durationDays = Math.round((Date.now() - current.startTimestamp) / (1000 * 60 * 60 * 24));
    }
  }

  return fileAuthors;
}

function detectOwnershipChanges(fileAuthors, options = {}) {
  const windowDays = options.windowDays || OWNERSHIP_CONSTANTS.RAPID_CHANGE_WINDOW_DAYS;
  const rapidChangeThreshold = options.rapidChangeThreshold || OWNERSHIP_CONSTANTS.RAPID_CHANGE_THRESHOLD;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  const ownershipChanges = {};
  for (const file of Object.keys(fileAuthors)) {
    const { ownerHistory, authors, commitHistory } = fileAuthors[file];

    console.log(`Inspecting ${file}`, fileAuthors[file]);
    if (!Array.isArray(ownerHistory) || !authors || !Array.isArray(commitHistory)) {
      console.warn(`Skipping ${file} due to invalid structure`, fileAuthors[file]);
      continue;
    }

    const totalOwners = authors.size;
    const totalChanges = Math.max(0, ownerHistory.length - 1);

    if (totalOwners < 2 || ownerHistory.length < 2) {
      ownershipChanges[file] = {
        totalOwners,
        totalChanges,
        rapidChanges: [],
        hasRapidChanges: false,
        averageOwnershipDuration: 0
      };
      continue;
    }

    let rapidChanges = [];
    let window = [];

    for (let i = 1; i < ownerHistory.length; i++) {
      const change = {
        from: ownerHistory[i - 1].author,
        to: ownerHistory[i].author,
        timestamp: ownerHistory[i].startTimestamp
      };
      window.push(change);
      window = window.filter(c => change.timestamp - c.timestamp <= windowMs);

      if (window.length >= rapidChangeThreshold) {
        const authorsInWindow = new Set(window.map(c => c.to));
        authorsInWindow.add(window[0].from);

        rapidChanges.push({
          startDate: new Date(window[0].timestamp).toISOString(),
          endDate: new Date(change.timestamp).toISOString(),
          durationDays: Math.round((change.timestamp - window[0].timestamp) / (1000 * 60 * 60 * 24)),
          changes: window.length,
          uniqueAuthors: authorsInWindow.size,
          authors: Array.from(authorsInWindow)
        });
      }
    }

    const totalDuration = ownerHistory.reduce((acc, r) => acc + (r.durationDays || 0), 0);
    const avgDuration = ownerHistory.length > 0 ? totalDuration / ownerHistory.length : 0;

    ownershipChanges[file] = {
      totalOwners,
      totalChanges,
      rapidChanges,
      hasRapidChanges: rapidChanges.length > 0,
      averageOwnershipDuration: avgDuration
    };
  }

  return ownershipChanges;
}

function calculateStabilityScores(fileAuthors, ownershipChanges) {
  const stabilityScores = {};

  let maxAuthors = 1;
  let maxChanges = 1;

  for (const file in ownershipChanges) {
    maxAuthors = Math.max(maxAuthors, ownershipChanges[file].totalOwners);
    maxChanges = Math.max(maxChanges, ownershipChanges[file].totalChanges);
  }

  for (const file in ownershipChanges) {
    const { totalOwners, totalChanges, hasRapidChanges, averageOwnershipDuration } = ownershipChanges[file];
    const commitCount = fileAuthors[file].commitHistory.length;

    if (commitCount < 3) {
      stabilityScores[file] = {
        score: null,
        classification: 'insufficient-data',
        commitCount
      };
      continue;
    }

    const normAuthor = 1 - ((totalOwners - 1) / ((maxAuthors - 1) || 1));
    const freq = totalChanges / commitCount;
    const normFreq = 1 - Math.min(1, freq * 2);
    const normDuration = Math.min(1, averageOwnershipDuration / 90);
    const penalty = hasRapidChanges ? 0.3 : 0;

    const weights = OWNERSHIP_CONSTANTS.WEIGHTS;
    let score = (
      weights.AUTHOR_COUNT * normAuthor +
      weights.CHANGE_FREQUENCY * normFreq +
      weights.OWNERSHIP_DURATION * normDuration
    ) - penalty;

    score = Math.max(0, Math.min(1, score));

    let classification = 'low-stability';
    if (score >= OWNERSHIP_CONSTANTS.HIGH_STABILITY_THRESHOLD) classification = 'high-stability';
    else if (score >= OWNERSHIP_CONSTANTS.MEDIUM_STABILITY_THRESHOLD) classification = 'medium-stability';

    stabilityScores[file] = {
      score,
      classification,
      commitCount,
      hasRapidChanges
    };
  }

  return stabilityScores;
}

function generateOwnershipInsights(fileAuthors, ownershipChanges, stabilityScores) {
  const insights = {
    overallInsights: {
      totalFilesAnalyzed: Object.keys(fileAuthors).length,
      ownershipIssuesDetected: 0,
      rapidChangesDetected: 0,
      stableFiles: 0,
      unstableFiles: 0,
      insufficientDataFiles: 0
    },
    fileInsights: {},
    recommendations: []
  };

  for (const file in stabilityScores) {
    const stability = stabilityScores[file];
    const changes = ownershipChanges[file];
    const authors = fileAuthors[file];

    if (stability.classification === 'insufficient-data') {
      insights.overallInsights.insufficientDataFiles++;
      continue;
    }

    if (stability.classification === 'high-stability') insights.overallInsights.stableFiles++;
    else {
      insights.overallInsights.unstableFiles++;
      insights.overallInsights.ownershipIssuesDetected++;
    }

    if (stability.hasRapidChanges) {
      insights.overallInsights.rapidChangesDetected++;
    }

    insights.fileInsights[file] = {
      score: stability.score,
      classification: stability.classification,
      currentOwner: authors.currentOwner,
      commitCount: stability.commitCount,
      suggestions: [],
      rapidChanges: changes.hasRapidChanges ? changes.rapidChanges : []
    };

    if (stability.classification === 'low-stability') {
      insights.fileInsights[file].suggestions.push(
        'Reduce ownership changes',
        'Assign long-term owners',
        'Document ownership clearly'
      );
      insights.recommendations.push({
        file,
        score: stability.score,
        summary: 'Low stability detected',
        suggestions: insights.fileInsights[file].suggestions
      });
    }
  }

  return insights;
}

function analyzeOwnershipDrift(commits, options = {}) {
  const fileAuthors = extractFileAuthorships(commits);
  const ownershipChanges = detectOwnershipChanges(fileAuthors, options);
  const stabilityScores = calculateStabilityScores(fileAuthors, ownershipChanges);
  const insights = generateOwnershipInsights(fileAuthors, ownershipChanges, stabilityScores);

  const sorted = Object.entries(stabilityScores)
    .filter(([, s]) => s.score !== null)
    .sort(([, a], [, b]) => a.score - b.score)
    .map(([file]) => file);

  return {
    fileAuthors,
    ownershipChanges,
    stabilityScores,
    insights,
    sortedFiles: sorted,
    unstableFiles: sorted.filter(f => stabilityScores[f].classification === 'low-stability'),
    mediumStabilityFiles: sorted.filter(f => stabilityScores[f].classification === 'medium-stability'),
    highStabilityFiles: sorted.filter(f => stabilityScores[f].classification === 'high-stability')
  };
}

function generateOwnershipReport(analysis) {
  const { insights, unstableFiles, mediumStabilityFiles } = analysis;

  let md = `# Ownership Analysis Report\n\n`;
  md += `## Summary\n`;
  md += `- Total files analyzed: ${insights.overallInsights.totalFilesAnalyzed}\n`;
  md += `- Ownership issues: ${insights.overallInsights.ownershipIssuesDetected}\n`;
  md += `- Rapid changes: ${insights.overallInsights.rapidChangesDetected}\n`;
  md += `- High stability: ${insights.overallInsights.stableFiles}\n`;
  md += `- Low stability: ${insights.overallInsights.unstableFiles}\n\n`;

  if (insights.recommendations.length > 0) {
    md += `## Recommendations\n`;
    for (const r of insights.recommendations) {
      md += `### ${r.summary} — ${r.file}\n`;
      md += `- Score: ${r.score.toFixed(2)}\n`;
      for (const s of r.suggestions) {
        md += `- ${s}\n`;
      }
      md += `\n`;
    }
  }

  if (unstableFiles.length > 0) {
    md += `## Unstable Files\n`;
    for (const file of unstableFiles) {
      const f = insights.fileInsights[file];
      md += `### ${file}\n- Score: ${f.score.toFixed(2)}\n- Suggestions: ${f.suggestions.join(', ')}\n\n`;
    }
  }

  if (mediumStabilityFiles.length > 0) {
    md += `## Medium Stability Files\n`;
    for (const file of mediumStabilityFiles) {
      const f = insights.fileInsights[file];
      md += `### ${file}\n- Score: ${f.score.toFixed(2)}\n\n`;
    }
  }

  return md;
}

module.exports = {
  OWNERSHIP_CONSTANTS,
  extractFileAuthorships,
  detectOwnershipChanges,
  calculateStabilityScores,
  generateOwnershipInsights,
  analyzeOwnershipDrift,
  generateOwnershipReport,
  analyze: analyzeOwnershipDrift
};