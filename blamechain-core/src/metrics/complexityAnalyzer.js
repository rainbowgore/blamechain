const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

/**
 * Analyzes code complexity from git diff output
 * @param {string} diffOutput - The git diff output
 * @returns {Object} Complexity analysis
 */
function analyzeComplexity(diffOutput) {
    const changedFunctions = extractChangedFunctions(diffOutput);
    return changedFunctions.map(func => calculateComplexityMetrics(func));
}

/**
 * Extracts changed functions from a diff output
 * @param {string} diffOutput - The git diff output
 * @returns {Array} List of changed function objects with before/after content
 */
function extractChangedFunctions(diffOutput) {
    const changedFunctions = [];
    const functionStartPattern = /^[\+\-].*function\s+\w+/;
    const functionEndPattern = /^[\+\-]\s*}/;
    const jsFileExtensionPattern = /\.(jstsjsxtsx)$/;
    const diffFiles = diffOutput.split('diff --git');

    for (const fileContent of diffFiles) {
        if (!fileContent.trim()) {
            continue;
        }

        if (!jsFileExtensionPattern.test(fileContent)) {
            continue;
        }

        const fileLines = fileContent.split('\n');
        const fileName = extractFileName(fileLines);

        const functionsInFile = extractFunctionsFromFileLines(fileLines, fileName);
        changedFunctions.push(...functionsInFile);
    }

    return changedFunctions;
}

function extractFileName(fileLines) {
    for (const line of fileLines) {
        if (line.startsWith('+++')) {
            return line.replace('+++ b/', '');
        }
    }
    return '';
}

function extractFunctionsFromFileLines(fileLines, fileName) {
    const functionsFound = [];
    const functionStartPattern = /^[\+\-].*function\s+\w+/;
    const functionEndPattern = /^[\+\-]\s*}/;
    let inFunction = false;
    let functionName = '';
    let beforeLines = [];
    let afterLines = [];

    for (const line of fileLines) {
        if (!inFunction && functionStartPattern.test(line)) {
            inFunction = true;
            functionName = extractFunctionName(line);

            addLineToAppropriateVersion(line, beforeLines, afterLines);
            continue;
        }

        if (inFunction) {
            addLineToAppropriateVersion(line, beforeLines, afterLines);

            if (functionEndPattern.test(line)) {
                functionsFound.push(createFunctionObject(fileName, functionName, beforeLines, afterLines));
                inFunction = false;
                beforeLines = [];
                afterLines = [];
                functionName = '';
            }
        }
    }

    return functionsFound;
}

function extractFunctionName(line) {
    const match = line.match(/function\s+(\w+)/);
    return match ? match[1] : '';
}

function addLineToAppropriateVersion(line, beforeLines, afterLines) {
    if (line.startsWith('-')) {
        beforeLines.push(line.substring(1));
    } else if (line.startsWith('+')) {
        afterLines.push(line.substring(1));
    } else if (!line.startsWith('@')) {
        beforeLines.push(line);
        afterLines.push(line);
    }
}

function createFunctionObject(fileName, functionName, beforeLines, afterLines) {
    return {
        file: fileName,
        name: functionName,
        before: beforeLines.join('\n'),
        after: afterLines.join('\n')
    };
}

/**
 * Calculates complexity metrics for a function
 * @param {Object} functionObj - Function object with before/after content
 * @returns {Object} Complexity metrics for the function
 */
function calculateComplexityMetrics(functionObj) {
    const beforeMetrics = calculateSingleFunctionComplexity(functionObj.before);
    const afterMetrics = calculateSingleFunctionComplexity(functionObj.after);

    const complexityIncrease = afterMetrics.complexity - beforeMetrics.complexity;
    const lineCountChange = afterMetrics.lineCount - beforeMetrics.lineCount;
    const nestingLevelChange = afterMetrics.maxNestingLevel - beforeMetrics.maxNestingLevel;

    return {
        file: functionObj.file,
        function: functionObj.name,
        beforeComplexity: beforeMetrics.complexity,
        afterComplexity: afterMetrics.complexity,
        complexityIncrease,
        lineCountChange,
        nestingLevelChange,
        beforeLineCount: beforeMetrics.lineCount,
        afterLineCount: afterMetrics.lineCount,
        isComplexityIncreasing: complexityIncrease > 0,
        isSignificantIncrease: (complexityIncrease > 3 && nestingLevelChange > 1),
        refactoringCandidate: (complexityIncrease > 5) || (complexityIncrease > 3 && nestingLevelChange > 0)
    };
}

/**
 * Calculates complexity metrics for a single function
 * @param {string} functionCode - The function code
 * @returns {Object} Complexity metrics
 */
function calculateSingleFunctionComplexity(functionCode) {
    const lines = functionCode.split('\n');
    const lineCount = lines.length;

    const controlStructureCounts = countControlStructures(functionCode);
    const logicalOperators = countLogicalOperators(functionCode);
    const maxNestingLevel = calculateMaxNestingLevel(lines);

    const totalControlStructures =
        controlStructureCounts.ifStatements +
        controlStructureCounts.forLoops +
        controlStructureCounts.whileLoops +
        controlStructureCounts.doWhileLoops +
        controlStructureCounts.switchCases +
        controlStructureCounts.catchBlocks;

    const cyclomaticComplexity = 1 + totalControlStructures + logicalOperators;

    return {
        lineCount,
        complexity: cyclomaticComplexity,
        maxNestingLevel,
        controlStructures: totalControlStructures + controlStructureCounts.elseStatements,
        logicalOperators
    };
}

function countControlStructures(code) {
    return {
        ifStatements: countPatternOccurrences(code, /\bif\s*\(/g),
        elseStatements: countPatternOccurrences(code, /\belse\b/g),
        forLoops: countPatternOccurrences(code, /\bfor\s*\(/g),
        whileLoops: countPatternOccurrences(code, /\bwhile\s*\(/g),
        doWhileLoops: countPatternOccurrences(code, /\bdo\s*\{/g),
        switchCases: countPatternOccurrences(code, /\bcase\b/g),
        catchBlocks: countPatternOccurrences(code, /\bcatch\s*\(/g)
    };
}

function countLogicalOperators(code) {
    return countPatternOccurrences(code, /(&&|\|\|)/g);
}

function countPatternOccurrences(text, pattern) {
    const matches = text.match(pattern);
    return matches ? matches.length : 0;
}

function calculateMaxNestingLevel(lines) {
    let maxLevel = 0;
    let currentLevel = 0;

    for (const line of lines) {
        const openBraces = countPatternOccurrences(line, /\{/g);
        const closeBraces = countPatternOccurrences(line, /\}/g);

        currentLevel += openBraces - closeBraces;
        maxLevel = Math.max(maxLevel, currentLevel);
    }

    return maxLevel;
}

/**
 * Analyzes complexity changes for a specific commit
 * @param {string} commitHash - The commit hash to analyze
 * @returns {Promise<Array>} List of complexity changes
 */
async function analyzeComplexityForCommit(commitHash) {
    try {
        const diffOutput = await getCommitDiff(commitHash);
        return analyzeComplexity(diffOutput);
    } catch (error) {
        console.error(`Error analyzing complexity for commit ${commitHash}: ${error.message}`);
        return [];
    }
}

async function getCommitDiff(commitHash) {
    const { stdout } = await execAsync(`git show ${commitHash} --unified=3`);
    return stdout;
}

/**
 * Get a list of functions that are becoming more complex over time
 * @param {Array} commits - Array of commit objects
 * @returns {Promise<Object>} Object containing complexity changes and trends
 */
async function trackComplexityTrends(commits) {
    const functionComplexityMap = {};
    const complexityResults = [];

    for (const commit of commits) {
        const complexityChanges = await analyzeComplexityForCommit(commit.hash);

        for (const change of complexityChanges) {
            const functionKey = `${change.file}::${change.function}`;

            initializeComplexityTracking(functionComplexityMap, functionKey, change);

            recordComplexityHistoryPoint(functionComplexityMap[functionKey], change, commit);

            updateRefactoringCandidateStatus(functionComplexityMap[functionKey], change);

            if (change.isComplexityIncreasing) {
                recordComplexityIncreaseEvent(complexityResults, change, commit);
            }
        }
    }

    const complexityTrends = calculateComplexityTrends(functionComplexityMap);

    return {
        complexityChanges: complexityResults,
        complexityTrends: filterRelevantTrends(complexityTrends)
    };
}

function initializeComplexityTracking(functionMap, functionKey, change) {
    if (!functionMap[functionKey]) {
        functionMap[functionKey] = {
            file: change.file,
            function: change.function,
            complexityHistory: [],
            refactoringCandidate: false
        };
    }
}

function recordComplexityHistoryPoint(functionData, change, commit) {
    functionData.complexityHistory.push({
        commitHash: commit.hash,
        date: commit.date,
        complexity: change.afterComplexity,
        complexityIncrease: change.complexityIncrease,
        isSignificantIncrease: change.isSignificantIncrease
    });
}

function updateRefactoringCandidateStatus(functionData, change) {
    if (change.refactoringCandidate) {
        functionData.refactoringCandidate = true;
    }
}

function recordComplexityIncreaseEvent(results, change, commit) {
    results.push({
        ...change,
        commitHash: commit.hash,
        date: commit.date,
        author: commit.author
    });
}

function calculateComplexityTrends(functionMap) {
    return Object.values(functionMap).map(func => {
        const history = func.complexityHistory;

        if (history.length < 2) {
            return createTrendDataWithoutHistory(func);
        }

        const complexityGrowthRate = calculateGrowthRate(history);
        const increasingTrend = determineIfTrendIsIncreasing(history);

        return {
            ...func,
            increasingTrend,
            complexityGrowthRate,
            needsRefactoring: increasingTrend && complexityGrowthRate > 1.5
        };
    });
}

function createTrendDataWithoutHistory(func) {
    return {
        ...func,
        increasingTrend: false,
        complexityGrowthRate: 0
    };
}

function calculateGrowthRate(history) {
    const firstComplexity = history[0].complexity;
    const lastComplexity = history[history.length - 1].complexity;
    return (lastComplexity - firstComplexity) / history.length;
}

function determineIfTrendIsIncreasing(history) {
    let increasingCount = 0;

    for (let i = 1; i < history.length; i++) {
        if (history[i].complexity > history[i - 1].complexity) {
            increasingCount++;
        }
    }

    return increasingCount > (history.length / 2);
}

function filterRelevantTrends(trends) {
    return trends.filter(trend => trend.increasingTrend || trend.refactoringCandidate);
}

/**
 * Analyzes function-level complexity in relation to churn rate
 * @param {Array} commits - Array of commit objects with file changes
 * @param {Array} functionComplexityData - Array of function complexity objects from trackComplexityTrends
 * @returns {Promise<Object>} Detailed analysis of functions with both high complexity and high churn
 */
async function analyzeFunctionLevelComplexityAndChurn(commits, functionComplexityData) {
    // Track function-level churn (how often each function is modified)
    const functionChurnMap = {};
    const fileChurnMap = {};

    // Process each commit to build churn data
    for (const commit of commits) {
        try {
            const diffOutput = await getCommitDiff(commit.hash);
            const changedFunctions = extractChangedFunctions(diffOutput);

            // Track file-level churn
            for (const func of changedFunctions) {
                const fileName = func.file;
                if (!fileChurnMap[fileName]) {
                    fileChurnMap[fileName] = {
                        file: fileName,
                        changeCount: 0,
                        lastModified: null,
                        authors: new Set(),
                        commits: new Set()
                    };
                }

                fileChurnMap[fileName].changeCount++;
                fileChurnMap[fileName].lastModified = commit.date;
                fileChurnMap[fileName].authors.add(commit.author);
                fileChurnMap[fileName].commits.add(commit.hash);

                // Track function-level churn
                const functionKey = `${func.file}::${func.name}`;
                if (!functionChurnMap[functionKey]) {
                    functionChurnMap[functionKey] = {
                        file: func.file,
                        function: func.name,
                        changeCount: 0,
                        lastModified: null,
                        authors: new Set(),
                        commits: new Set(),
                        churnHistory: []
                    };
                }

                functionChurnMap[functionKey].changeCount++;
                functionChurnMap[functionKey].lastModified = commit.date;
                functionChurnMap[functionKey].authors.add(commit.author);
                functionChurnMap[functionKey].commits.add(commit.hash);

                // Record churn history point
                functionChurnMap[functionKey].churnHistory.push({
                    commitHash: commit.hash,
                    date: commit.date,
                    author: commit.author
                });
            }
        } catch (error) {
            console.error(`Error processing commit ${commit.hash} for churn analysis: ${error.message}`);
        }
    }

    // Convert Sets to arrays in churn maps
    Object.values(fileChurnMap).forEach(file => {
        file.authors = [...file.authors];
        file.commits = [...file.commits];
        file.authorCount = file.authors.length;
        file.commitCount = file.commits.length;
    });

    Object.values(functionChurnMap).forEach(func => {
        func.authors = [...func.authors];
        func.commits = [...func.commits];
        func.authorCount = func.authors.length;
        func.commitCount = func.commits.length;
    });

    // Combine complexity and churn data for comprehensive analysis
    const combinedAnalysis = [];

    // Create a map from complexity data for easier lookup
    const complexityMap = {};
    if (functionComplexityData && functionComplexityData.complexityTrends) {
        functionComplexityData.complexityTrends.forEach(trend => {
            const key = `${trend.file}::${trend.function}`;
            complexityMap[key] = trend;
        });
    }

    // Process each function to create combined metrics
    for (const [functionKey, churnData] of Object.entries(functionChurnMap)) {
        // Skip functions with no churn data (should not happen)
        if (churnData.changeCount === 0) continue;

        // Get complexity data if available
        const complexityData = complexityMap[functionKey] || null;

        // Calculate normalized churn rate (0-10 scale)
        // Higher values indicate more frequent changes
        const normalizedChurnRate = Math.min(10, churnData.changeCount / 2);

        // Calculate normalized complexity (0-10 scale)
        let normalizedComplexity = 0;
        let latestComplexity = 0;
        let complexityTrend = 0;

        if (complexityData && complexityData.complexityHistory && complexityData.complexityHistory.length > 0) {
            const history = complexityData.complexityHistory;
            latestComplexity = history[history.length - 1].complexity;
            normalizedComplexity = Math.min(10, latestComplexity / 5);

            if (history.length > 1) {
                complexityTrend = complexityData.complexityGrowthRate || 0;
            }
        }

        // Calculate risk score combining both complexity and churn
        // Formula gives higher weight to functions that are both complex and frequently changed
        const riskScore = (normalizedComplexity * 0.6) + (normalizedChurnRate * 0.4) + (complexityTrend * 2);

        combinedAnalysis.push({
            file: churnData.file,
            function: churnData.function,
            // Churn metrics
            changeCount: churnData.changeCount,
            churnRate: normalizedChurnRate,
            authorCount: churnData.authorCount,
            authors: churnData.authors,
            lastModified: churnData.lastModified,
            // Complexity metrics
            complexity: latestComplexity,
            normalizedComplexity,
            complexityTrend,
            increasingComplexity: complexityData ? complexityData.increasingTrend || false : false,
            // Combined metrics
            riskScore: parseFloat(riskScore.toFixed(2)),
            riskLevel: getRiskLevel(riskScore),
            isRefactoringCandidate: riskScore > 7 && (normalizedComplexity > 7 && normalizedChurnRate > 5)
        });
    }

    // Sort by risk score (highest first)
    combinedAnalysis.sort((a, b) => b.riskScore - a.riskScore);

    // Group by risk level
    const riskGroups = {
        high: combinedAnalysis.filter(item => item.riskLevel === 'High'),
        medium: combinedAnalysis.filter(item => item.riskLevel === 'Medium'),
        low: combinedAnalysis.filter(item => item.riskLevel === 'Low')
    };

    // Calculate summary statistics
    const summary = {
        totalFunctionsAnalyzed: combinedAnalysis.length,
        highRiskFunctions: riskGroups.high.length,
        mediumRiskFunctions: riskGroups.medium.length,
        lowRiskFunctions: riskGroups.low.length,
        refactoringCandidates: combinedAnalysis.filter(item => item.isRefactoringCandidate).length
    };

    return {
        summary,
        riskGroups,
        detailedAnalysis: combinedAnalysis,
        fileChurnMap: Object.values(fileChurnMap).sort((a, b) => b.changeCount - a.changeCount)
    };
}

/**
 * Determines the risk level based on the calculated risk score
 * @param {number} score - The calculated risk score
 * @returns {string} Risk level (High, Medium, Low)
 */
function getRiskLevel(score) {
    if (score >= 7) return 'High';
    if (score >= 4) return 'Medium';
    return 'Low';
}

module.exports = {
    analyzeComplexity,
    analyzeComplexityForCommit,
    trackComplexityTrends,
    analyzeFunctionLevelComplexityAndChurn
};
