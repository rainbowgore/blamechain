const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { buildCommitGraph } = require('../src/graph/commitGraphBuilder');
const args = require('minimist')(process.argv.slice(2));

const repoPath = args.repo;
if (!repoPath) {
  console.error('Missing --repo argument.');
  process.exit(1);
}

const gitFolder = path.join(repoPath, '.git');
if (!fs.existsSync(repoPath) || !fs.existsSync(gitFolder)) {
  console.error(`Invalid Git repository: ${repoPath}`);
  process.exit(1);
}

function getCommits(repo) {
  try {
    const format = [
      '--pretty=format:--%n%H%n%an%n%ad%n%s',
      '--date=iso-strict',
      '--name-only'
    ];
    const log = execSync(`git -C "${repo}" log ${format.join(' ')}`, { encoding: 'utf8' });
    const lines = log.split('\n');
    const commits = [];

    let current = null;
    for (const line of lines) {
      if (line === '--') {
        if (current) commits.push(current);
        current = { files: [] };
      } else if (current && !current.hash) {
        current.hash = line;
      } else if (current && !current.author) {
        current.author = line;
      } else if (current && !current.date) {
        current.date = line;
      } else if (current && !current.message) {
        current.message = line;
      } else {
        current.files.push(line.trim());
      }
    }

    if (current) commits.push(current);
    return commits.filter(c => c.files.length > 0);
  } catch (err) {
    console.error('Failed to fetch commit log:', err.message);
    process.exit(1);
  }
}

function writeGraphFile(graph) {
  const outputDir = path.resolve(__dirname, '../output/data');
  const outputPath = path.join(outputDir, 'graph.json');
  fs.mkdirSync(outputDir, { recursive: true });

  try {
    fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2), 'utf8');
    console.log(`Commit graph saved to: ${outputPath}`);
  } catch (err) {
    console.error('Failed to write graph file:', err.message);
    process.exit(1);
  }
}

console.log(`Extracting commits from: ${repoPath}`);
const commits = getCommits(repoPath);
console.log(`Found ${commits.length} commits`);

const graph = buildCommitGraph(commits);
writeGraphFile(graph);