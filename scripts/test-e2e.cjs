// Run the shipped images against a synthetic TLS upstream, then remove only
// this invocation's isolated Compose project and ephemeral certificate volume.
const { spawnSync } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
process.chdir(path.resolve(__dirname, ".."));
async function port() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
(async () => {
  const web = await port(), control = await port();
  const env = { ...process.env, E2E_PORT: String(web), E2E_CONTROL_PORT: String(control), E2E_BASE_URL: `http://127.0.0.1:${web}`, E2E_CONTROL_URL: `http://127.0.0.1:${control}` };
  const prefix = ["compose", "-p", `news-stability-e2e-${process.pid}`, "-f", "compose.e2e.yaml"];
  const run = (command, args) => {
    const result = spawnSync(command, args, { env, stdio: "inherit" });
    if (result.error) throw result.error;
    return result.status ?? 1;
  };
  let status = 1;
  try {
    status = run("docker", [...prefix, "up", "--build", "--detach", "--wait", "--wait-timeout", "180"]);
    if (!status) status = run(process.execPath, [require.resolve("@playwright/test/cli"), "test", "--config", "playwright.e2e.config.cjs"]);
  } finally {
    if (status) run("docker", [...prefix, "logs", "--no-color", "--tail", "100"]);
    const cleanup = run("docker", [...prefix, "down", "--volumes", "--remove-orphans"]);
    process.exitCode = status || cleanup;
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
