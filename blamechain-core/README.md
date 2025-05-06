# Blamechain

![Blamechain](graph.png)

A comprehensive Git repository analysis tool for identifying code health issues, developer patterns, and project risks.

## Overview

Blamechain analyzes your Git repository to visualize and identify:

- **Code churn** and hotspots
- **Function-level complexity** and how it evolves over time
- **Developer ownership** patterns and knowledge silos
- **Developer burnout** risk factors
- **Feature death** and abandoned code
- **Pull request metrics** and review patterns

The tool generates visual reports, identifies potential risks, and provides actionable insights to improve code health and team workflows.

## Installation

### Prerequisites

- Node.js (v14 or later)
- Git
- A local Git repository to analyze

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/blamechain.git
   cd blamechain
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Make scripts executable (optional):
   ```bash
   chmod +x *.js
   ```

## Usage

### Basic Usage

Run the main script on your Git repository:

```bash
./blamechain.js -r /path/to/your/repository
```

This will generate basic analysis files in the current directory.

### Generating Specific Analyses

#### Code Churn Analysis

```bash
./complexityAnalyzer.js --repo /path/to/your/repository
```

#### Pull Request Analysis

```bash
./pr-analysis.js --repo /path/to/your/repository --token YOUR_GITHUB_TOKEN
```

#### Burnout Detection

```bash
./burnout-analysis.js --repo /path/to/your/repository
```

#### Feature Death Analysis

```bash
./feature-death-analysis.js --repo /path/to/your/repository
```

#### Combined Insights

```bash
./combined-insights.js
```

#### ASCII Graph Visualization

```bash
./ascii-graph.js --mode detailed
```

## Components

### 1. Code Churn and Complexity Analysis

Identifies frequently changed files and functions, calculating complexity metrics and risk scores based on:

- Cyclomatic complexity
- Nesting levels
- Change frequency
- Function-level complexity trends

The analysis helps identify code that is becoming increasingly complex over time, highlighting refactoring candidates.

### 2. GitHub Pull Request Analysis

Analyzes pull request patterns to provide insights on:

- PR approval times
- Reviewer distribution
- Stale PRs
- Connection between PRs and commits

This helps identify bottlenecks in your code review process and areas where reviews may be insufficient.

### 3. Enhanced Visualizations

Provides multiple visualization options:

- **PNG graph exports** with color-coded risk indicators
- **JSON data exports** for integration with other tools
- **Timeline visualizations** (daily, weekly, monthly)
- **ASCII graph rendering** for terminal-based visualization

### 4. Intelligence/Insight Layer

Advanced analysis modules that identify:

- **Ownership Drift Detection**: Identifies files with changing ownership that may lead to knowledge silos
- **Commit Burnout Detection**: Identifies developers at risk of burnout based on commit patterns
- **Feature Death Tracker**: Finds potentially abandoned code and features

### 5. Automated Insights

Generates actionable insights by:

- Identifying areas with high churn and unresolved TODOs
- Suggesting refactoring zones
- Prioritizing issues based on risk scores
- Generating specific action items

## Visualizations

### Commit Graph

The main visualization shows commits over time with risk indicators:

![Commit Graph](graph.png)

### Timeline Views

Timeline views aggregate commit activity by different time periods:

- Daily: ![Daily Timeline](timeline-daily.png)
- Weekly: ![Weekly Timeline](timeline-weekly.png)
- Monthly: ![Monthly Timeline](timeline-monthly.png)

### ASCII Graph

Terminal-based ASCII graph rendering:

```
  Commit    Author            Date        Message
  ────────────────────────────────────────────────────────────────────────────
● 36bebe5 rainbowgits     2025-04-30 More uselessness for git log [+1/-0, churn: 1]
│
│ ● cc5c16 rainbowgits     2025-04-30 Added useless comment to make fake history
│ │
│ │ ● 6d8f76 rainbowgits     2025-04-30 Touched format.js to create commit history
  
```

## Configuration Options

Most analysis scripts accept the following configuration options:

### General Options

- `--repo, -r`: Path to Git repository
- `--output, -o`: Output file path
- `--json, -j`: Path to export JSON data
- `--verbose, -v`: Enable verbose output

### Analysis-Specific Options

#### Code Complexity Analysis

- `--high-complexity`: Threshold for high complexity (default: 15)
- `--include-patterns`: Glob patterns to include specific files
- `--exclude-patterns`: Glob patterns to exclude specific files

#### Burnout Analysis

- `--time-period`: Time period to analyze (days, default: 90)
- `--commit-threshold`: Daily commit threshold for burnout risk (default: 15)

#### Feature Death Analysis

- `--extreme-days`: Days for extreme staleness (default: 180)
- `--high-days`: Days for high staleness (default: 90)
- `--medium-days`: Days for medium staleness (default: 30)

## Command-Line Interface

### Main Commands

| Command | Description |
|---------|-------------|
| `./blamechain.js` | Main command to analyze repository |
| `./ownership-analysis.js` | Analyze code ownership patterns |
| `./burnout-analysis.js` | Detect potential developer burnout |
| `./feature-death-analysis.js` | Find abandoned code |
| `./enhanced-timeline.js` | Generate timeline visualizations |
| `./combined-insights.js` | Generate combined insights report |
| `./ascii-graph.js` | Generate ASCII graph visualization |

### Common Options

| Option | Description | Default |
|--------|-------------|---------|
| `--help, -h` | Show help menu | |
| `--repo, -r` | Repository path | Current directory |
| `--output, -o` | Output file path | Varies by script |
| `--json, -j` | Export JSON data | |
| `--verbose, -v` | Verbose mode | `false` |

### ASCII Graph Options

| Option | Description | Default |
|--------|-------------|---------|
| `--input, -i` | Path to graph.json | `graph.json` |
| `--mode, -m` | Display mode (basic/detailed) | `basic` |
| `--width, -w` | Maximum width for output | 80 |
| `--color, -c` | Enable/disable color | `true` |
| `--branch, -b` | Show branch lines | `true` |

## Contributing

Contributions to blamechain are welcome!

### Getting Started

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (if available)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style

Please follow these guidelines:

- Use meaningful variable and function names
- Document functions with JSDoc comments
- Keep functions small and focused
- Avoid hard-coded values; use constants
- Write tests for new functionality

### Feature Requests and Bug Reports

Please use the Issues section to report bugs or request features.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by various Git analysis tools including Git Blame, CodeScene, and git-quick-stats
- Built with Node.js and various visualization libraries

