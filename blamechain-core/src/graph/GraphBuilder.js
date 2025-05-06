/**
 * Track file evolution with enhanced churn metrics
 * @param {Array} commits - Array of commit objects with churn metrics
 * @returns {Array} File evolution data with churn metrics
 */
function trackFileEvolution(commits = []) {
    const evolutionMap = buildFileEvolutionMap(commits);
    return convertEvolutionMapToFileList(evolutionMap);
}

function buildFileEvolutionMap(commits) {
    const evolutionMap = {};
    
    commits.forEach(commit => {
        const filesToProcess = getFilesFromCommit(commit);
        
        filesToProcess.forEach(file => {
            ensureFileEntryExists(evolutionMap, file);
            updateFileAuthorsAndHistory(evolutionMap[file], commit);
            trackChurnMetricsForFile(evolutionMap[file], commit);
        });
    });
    
    return evolutionMap;
}

function getFilesFromCommit(commit) {
    const defaultFileName = commit.filename || 'unknown';
    return commit.files || [defaultFileName];
}

function ensureFileEntryExists(evolutionMap, fileName) {
    if (!evolutionMap[fileName]) {
        evolutionMap[fileName] = {
            authors: new Set(),
            history: [],
            churnHistory: [],
            totalInsertions: 0,
            totalDeletions: 0,
            totalChurn: 0
        };
    }
}

function updateFileAuthorsAndHistory(fileData, commit) {
    fileData.authors.add(commit.author);
    fileData.history.push(commit.message);
}

function trackChurnMetricsForFile(fileData, commit) {
    const insertions = commit.insertions || 0;
    const deletions = commit.deletions || 0;
    const churn = commit.churn || (insertions + deletions);
    
    addChurnHistoryEntry(fileData, commit.date, insertions, deletions, churn);
    updateTotalChurnMetrics(fileData, insertions, deletions, churn);
}

function addChurnHistoryEntry(fileData, date, insertions, deletions, churn) {
    fileData.churnHistory.push({
        date,
        insertions,
        deletions,
        churn
    });
}

function updateTotalChurnMetrics(fileData, insertions, deletions, churn) {
    fileData.totalInsertions += insertions;
    fileData.totalDeletions += deletions;
    fileData.totalChurn += churn;
}

function convertEvolutionMapToFileList(evolutionMap) {
    return Object.entries(evolutionMap).map(([fileName, fileData]) => {
        return {
            files: [fileName],
            authors: [...fileData.authors],
            messages: fileData.history,
            churnHistory: fileData.churnHistory,
            totalInsertions: fileData.totalInsertions,
            totalDeletions: fileData.totalDeletions,
            totalChurn: fileData.totalChurn,
            avgChurnPerCommit: calculateAverageChurnPerCommit(fileData)
        };
    });
}

function calculateAverageChurnPerCommit(fileData) {
    if (fileData.churnHistory.length === 0) {
        return 0;
    }
    
    return (fileData.totalChurn / fileData.churnHistory.length).toFixed(2);
}

module.exports = { trackFileEvolution };