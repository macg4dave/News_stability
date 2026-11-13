const { spawnSync } = require("node:child_process");
const path = require("node:path");
process.chdir(path.resolve(__dirname, ".."));
function run(command, args, capture = false) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: capture ? "pipe" : "inherit", encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) console.error(result.stderr);
    process.exit(result.status || 1);
  }
  return result.stdout || "";
}
const unformatted = run("gofmt", ["-l", "cmd", "internal", "tests/e2e/upstream"], true);
if (unformatted.trim()) { console.error(unformatted); process.exit(1); }
run("go", ["vet", "./..."]);
run("go", ["test", ...(process.platform === "win32" ? [] : ["-race"]), "./..."]);
run("go", ["build", "./..."]);
if (process.platform === "win32") run("docker", ["build", "--target", "test", "-f", "Dockerfile.reader", "."]);
run("go", ["mod", "download", "all"]);
run("python", ["scripts/update_notices.py", "--check"]);
run("python", ["-B", "-m", "unittest", "discover", "-s", "tests", "-v"]);
run(process.execPath, [require.resolve("@playwright/test/cli"), "test"]);
run(process.execPath, ["scripts/test-e2e.cjs"]);
