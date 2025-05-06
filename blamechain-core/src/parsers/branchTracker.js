const simpleGit = require('simple-git');
const git = simpleGit();

async function listBranches() {
    try {
        const branches = await git.branch();
        console.log('\nActive Branches:');
        Object.entries(branches.branches).forEach(([name, data]) => {
            console.log(`${name} - ${data.commit}`);
        });
    } catch (err) {
        console.error('Error: Failed to list branches.');
        console.error(err.message);
    }
}

module.exports = { listBranches };