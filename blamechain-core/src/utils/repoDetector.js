const fs = require('fs');
const path = require('path');

function extractRepoInfo() {
    try {
        const gitConfigPath = path.resolve(process.cwd(), '.git', 'config');
        const configContent = fs.readFileSync(gitConfigPath, 'utf8');
        const match = configContent.match(/url = .*[:\/]([^\/]+\/[^\/.]+)(\.git)?/);
        if (match && match[1]) {
            return match[1];
        }
        console.warn('[repoDetector] Could not parse repo from .git/config');
        return null;
    } catch (err) {
        console.warn('[repoDetector] Failed to read .git/config');
        return null;
    }
}

module.exports = { extractRepoInfo };