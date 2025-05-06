import { validateRepositories } from "./comparison/repoValidator";
import { extractRepoStats } from "./comparison/statsExtractor";
import { generateFullReport } from "./comparison/reportGenerator";

export async function analyzeRepos(
  repos: { path: string; name?: string }[],
  options?: { outputFile?: string }
): Promise<{ data: any; report: string }> {
  const repoPaths = repos.map(r => r.path);
  const repoNames = repos.map(r => r.name || r.path.split("/").pop() || "repo");

  const validRepos = validateRepositories(repoPaths, repoNames);
  const repoStats = [];

  for (const repo of validRepos) {
    try {
      const stats = extractRepoStats(repo.path);
      repoStats.push({ name: repo.name, stats });
    } catch (err) {
      console.warn(`Failed to analyze ${repo.name}: ${err.message}`);
    }
  }

  const report = generateFullReport(repoStats);

  if (options?.outputFile) {
    const fs = await import("fs/promises");
    await fs.writeFile(options.outputFile, report, "utf8");
  }

  return { data: repoStats, report };
}