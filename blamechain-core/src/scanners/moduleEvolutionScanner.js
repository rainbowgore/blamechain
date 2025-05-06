const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const git = simpleGit();

const VALID_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx'];

function getAllFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            getAllFiles(fullPath, files);
        } else if (VALID_EXTENSIONS.includes(path.extname(entry.name))) {
            files.push(fullPath);
        }
    }
    return files;
}

async function getFileContributors(filePath) {
    try {
        const log = await git.log({ file: filePath });
        const authors = new Set(log.all.map(entry => entry.author_name));
        return [...authors];
    } catch (err) {
        console.warn(`[moduleScanner] Could not analyze ${filePath}`);
        return [];
    }
}

/**
 * Analyzes file evolution by grouping files based on overlapping contributors
 * @param {string} baseDir - Base directory to analyze, defaults to 'src'
 * @returns {Promise<Array>} Clusters of files with related contributors
 */
async function analyzeFileEvolution(baseDir = 'src') {
    const files = getAllFiles(baseDir);
    const fileToContributorsMap = await buildFileContributorsMap(files);
    return clusterFilesBySharedContributors(fileToContributorsMap);
}

/**
 * Builds a mapping of files to their contributors
 * @param {Array<string>} files - List of file paths
 * @returns {Promise<Object>} Map of file paths to their contributors
 */
async function buildFileContributorsMap(files) {
    const fileContributorsMap = {};
    
    for (const filePath of files) {
        const fileContributors = await getFileContributors(filePath);
        fileContributorsMap[filePath] = fileContributors;
    }
    
    return fileContributorsMap;
}

/**
 * Clusters files based on shared contributors
 * @param {Object} fileContributorsMap - Map of files to their contributors
 * @returns {Array} Clusters of related files
 */
function clusterFilesBySharedContributors(fileContributorsMap) {
    const fileClusters = [];
    
    for (const [filePath, fileAuthors] of Object.entries(fileContributorsMap)) {
        const existingCluster = findClusterWithOverlappingAuthors(fileClusters, filePath, fileAuthors, fileContributorsMap);
        
        if (existingCluster) {
            addFileToCluster(existingCluster, filePath, fileAuthors);
        } else {
            createNewCluster(fileClusters, filePath, fileAuthors);
        }
    }
    
    return fileClusters;
}

/**
 * Finds a cluster that has files with authors overlapping with the given file
 * @param {Array} clusters - Existing file clusters
 * @param {string} filePath - Path of the file to check
 * @param {Array} fileAuthors - Authors of the file
 * @param {Object} fileContributorsMap - Map of all files to their contributors
 * @returns {Objectnull} Matching cluster or null if none found
 */
function findClusterWithOverlappingAuthors(clusters, filePath, fileAuthors, fileContributorsMap) {
    for (const cluster of clusters) {
        if (hasOverlappingAuthorsWithCluster(cluster, fileAuthors, fileContributorsMap)) {
            return cluster;
        }
    }
    
    return null;
}

/**
 * Checks if a file's authors overlap with any file in a cluster
 * @param {Object} cluster - Cluster to check
 * @param {Array} fileAuthors - Authors of the file to check
 * @param {Object} fileContributorsMap - Map of all files to their contributors
 * @returns {boolean} True if there's an overlap in authors
 */
function hasOverlappingAuthorsWithCluster(cluster, fileAuthors, fileContributorsMap) {
    for (const clusterFilePath of cluster.files) {
        const clusterFileAuthors = fileContributorsMap[clusterFilePath];
        const overlappingAuthors = fileAuthors.filter(author => clusterFileAuthors.includes(author));
        
        if (overlappingAuthors.length > 0) {
            return true;
        }
    }
    
    return false;
}

/**
 * Adds a file to an existing cluster and updates the cluster's author list
 * @param {Object} cluster - Cluster to add the file to
 * @param {string} filePath - Path of the file to add
 * @param {Array} fileAuthors - Authors of the file
 */
function addFileToCluster(cluster, filePath, fileAuthors) {
    cluster.files.push(filePath);
    cluster.authors = [...new Set([...cluster.authors, ...fileAuthors])];
}

/**
 * Creates a new cluster with a single file
 * @param {Array} clusters - List of clusters to add to
 * @param {string} filePath - Path of the file
 * @param {Array} fileAuthors - Authors of the file
 */
function createNewCluster(clusters, filePath, fileAuthors) {
    clusters.push({ files: [filePath], authors: fileAuthors });
}

module.exports = { analyzeFileEvolution };
