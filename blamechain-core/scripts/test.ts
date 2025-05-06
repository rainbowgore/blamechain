import { analyzeRepos } from "../src/index";

(async () => {
  const repos = [
    {
      path: "/Users/noasasson/Dev-projects/blamechain/mock-repo-1",
      name: "Mock Repo 1"
    },
    {
      path: "/Users/noasasson/Dev-projects/blamechain/mock-repo-2",
      name: "Mock Repo 2"
    }
  ];

  const result = await analyzeRepos(repos);

  console.log("\n=== DATA ===\n");
  console.dir(result.data, { depth: null });

  console.log("\n=== MARKDOWN REPORT ===\n");
  console.log(result.report);
})();