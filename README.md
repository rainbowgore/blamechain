# Blamechain

Blamechain is a modular Git analytics and engineering intelligence toolkit. It provides insights into codebase evolution, contributor behavior, and software development trends. Designed for codebase audits, technical reports, and engineering KPIs, Blamechain helps teams trace the history and health of their projects with precision.

## Key Features

### Git History Analysis

- Parses Git repositories to extract detailed commit metadata
- Tracks file evolution, rename chains, and refactor patterns
- Maps contributors to code areas and flags ownership drift

### Engineering Metrics

- Burnout detection based on contributor activity trends
- Feature death analysis for unused or stagnant modules
- Complexity increase and churn detection per commit
- Line insertions/deletions and contributor frequency metrics

### Pull Request Matching

- Associates commits with pull requests via hash, message, or API
- Fetches PR metadata and review timelines from GitHub
- Supports rate-limited, token-authenticated API usage

### Visualizations

- Generates commit graphs with author and module overlays
- Renders contribution timelines (daily, weekly, monthly)
- Exports images (`.png`) and graph data (`.json`) for reporting

### Reports and Exporting

- Produces high-level Markdown summaries per repository
- Comparative reports between repositories
- Outputs structured JSON for downstream analysis
- Supports filtered report generation by module, author, or time range

### Code Quality Insights

- Calculates code churn ratios and nesting level changes
- Highlights refactoring candidates based on threshold logic
- Tracks TODO comment evolution and abandonment

## Repository Structure

```plaintext
blamechain-core/
├── bin/                   # CLI entrypoints
├── backup-before-cleanup/ # Archived modules and legacy versions
├── output/                # Generated reports, visuals, data exports
├── scripts/               # CLI commands for end-to-end flows
├── src/                   # Primary source code for metrics, parsing, insights
├── tests/                 # Validation and test suites
```

## Example Reports and Visual Output

- `output/reports/*.md`: Contributor, ownership, burnout, and summary reports
- `output/visualizations/*.png`: Timelines and commit graphs
- `output/data/*.json`: Structured graph and metric data

## Use Cases

- Engineering team health tracking
- Contributor analysis for large or legacy projects
- Code ownership audits and bus factor measurement
- Cleanup and refactor candidate identification
- Technical KPIs for product or platform leadership

## Installation

Clone and install the core workspace:

```bash
# Clone the repository
git clone /path/to/your/local/blamechain
cd blamechain/blamechain-core
npm install
```

## Usage

Run an analysis pipeline:

```bash
# Full insight generation
node scripts/combined-insights.js --repo /path/to/your/repo

# Create a contribution timeline
node scripts/enhanced-timeline.js

# Run burnout or feature death detection
node scripts/burnout-analysis.js
node scripts/feature-death-analysis.js
```

## Environment Variables

Set the following environment variables for proper functionality:

```plaintext
GITHUB_TOKEN=your_github_token  # GitHub API token for pull request matching
CACHE_DIR=.cache                # Directory for caching API responses
CACHE_TTL=86400000              # Cache time-to-live in milliseconds
RETRY_DELAY=1000                # Delay between API retries in milliseconds
MAX_RETRIES=3                   # Maximum number of API retry attempts
```

### Requirements

- Node.js 18 or higher (tested on Node 20)
- Git CLI installed and accessible in your system path

## Development

Run all tests:

```bash
npm test
```

Check file syntax before commit:

```bash
node --check src/**/*.js
```

## Contributing

We welcome community contributions. Please open an issue to discuss before submitting a pull request.

## License

MIT License
