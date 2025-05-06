const fs = require('fs');
const { execSync } = require('child_process');

function isValidGitRepo(repoPath) {
  try {
    if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
      return false;
    }
    execSync(`git -C "${repoPath}" rev-parse --is-inside-work-tree`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function validateRepositories(paths, names) {
  const validRepos = [];

  paths.forEach((repoPath, index) => {
    if (isValidGitRepo(repoPath)) {
      validRepos.push({ path: repoPath, name: names[index] });
    } else {
      console.error(`Invalid Git repository: ${repoPath}`);
    }
  });

  return validRepos;
}

module.exports = {
  isValidGitRepo,
  validateRepositories
};