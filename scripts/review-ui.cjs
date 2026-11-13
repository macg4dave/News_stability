// Produce a repeatable visual review without credentials or external requests.
const { chromium } = require("@playwright/test");
const { createServer } = require("node:http");
const { readFile, mkdir, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { fixture, story } = require("../tests/browser/fixture.cjs");

const root = path.resolve(__dirname, "../web");
const output = path.resolve(__dirname, "../.local/ui-review");
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".txt": "text/plain" };
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!file.startsWith(root + path.sep)) throw new Error("Invalid path");
    const content = await readFile(file);
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end();
  }
});

function examples() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const items = [
    { ...story("1:landscape", "A little room for the stories that matter"), picture: "https://fixture.invalid/landscape.svg", excerpt: "Synthetic scenery, a readable headline, and a short introduction to the day’s news." },
    { ...story("1:text", "A text-only story deserves the same care"), excerpt: "No picture is needed for a useful reading experience. Source, publication date, and reading time stay visible." },
    { ...story("1:long", "A very long headline that wraps naturally across narrow screens, larger text settings, and the quieter space of the magazine view"), saved: true, read: true },
    { ...story("1:japanese", "今日のニュースを、落ち着いて読むための新しい場所"), excerpt: "長い見出しと本文でも、読む順序と使いやすさを保ちます。" },
    { ...story("1:arabic", "مساحة هادئة لقراءة الأخبار والقصص اليومية"), excerpt: "تبقى العناوين والنصوص واضحة أثناء التصفح والقراءة." },
    { ...story("1:broken", "When a publisher picture is unavailable"), picture: "https://fixture.invalid/missing.svg", excerpt: "The headline and story remain available when a picture fails." },
    { ...story("1:older", "Yesterday’s coverage stays in NewsBlur’s order"), published_at: yesterday.toISOString(), excerpt: "Date boundaries continue across batches without reordering any stories." },
    { ...story("1:missing", ""), reading_minutes: 0 },
  ];
  return items.map((item, i) => ({
    ...item,
    ...(i < 6 ? { published_at: now.toISOString(), feed_title: "The Synthetic Journal", author: "Example desk" } : {}),
    html: `<p>${item.excerpt || "This is a synthetic article for reviewing the reader."}</p><h2>A comfortable reading space</h2><p>All content in this review is invented. Opening, reading, and returning to the collection use the same controls in every layout.</p><blockquote>A calm page keeps the story in view.</blockquote><p>Long-form text wraps within the available width. No account data or publisher assets are used.</p>`,
  }));
}

async function main() {
  await mkdir(output, { recursive: true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const images = [];
  try {
    for (const width of [1440, 390]) {
      for (const theme of ["light", "dark", "paper"]) {
        for (const layout of ["cards", "magazine", "list"]) {
          const page = await browser.newPage({ viewport: { width, height: 960 }, reducedMotion: "reduce", locale: "en-GB", timezoneId: "Europe/London" });
          const errors = [];
          page.on("pageerror", error => errors.push(error.message));
          const model = await fixture(page, origin);
          model.stories = examples();
          await page.route("https://fixture.invalid/**", route => route.request().url().endsWith("missing.svg")
            ? route.fulfill({ status: 404, body: "" })
            : route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"><rect width="960" height="540" fill="#bfd3d0"/><circle cx="720" cy="140" r="65" fill="#f1d6a0"/><path d="M0 420L270 150 570 440 780 240 960 400V540H0Z" fill="#698b78"/><path d="M0 480L320 350 610 490 960 390V540H0Z" fill="#365e50"/></svg>' }));
          await page.getByRole("button", { name: "Appearance", exact: true }).click();
          await page.getByLabel("Background", { exact: true }).selectOption(theme);
          await page.getByRole("button", { name: "Done", exact: true }).click();
          await page.getByLabel("Story layout", { exact: true }).selectOption(layout);
          await page.getByRole("button", { name: "Synthetic feed" }).click();
          await page.locator("#stories .story").first().waitFor();
          for (const mode of ["collection", "article"]) {
            if (mode === "article") {
              await page.locator("#stories .story").first().click();
              await page.locator("#full-text-status").filter({ hasText: "Full text from NewsBlur." }).waitFor();
            }
            await page.evaluate(async () => {
              // Trigger lazy pictures before capturing the complete collection.
              for (const img of document.querySelectorAll("img")) img.loading = "eager";
              await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
              await document.fonts.ready;
              window.scrollTo({ top: 0, behavior: "instant" });
            });
            if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error(`Horizontal overflow: ${width} ${theme} ${layout} ${mode}`);
            const name = `${width}-${theme}-${layout}-${mode}.png`;
            await page.screenshot({ path: path.join(output, name), fullPage: true });
            images.push({ name, width, theme, layout, mode });
          }
          if (errors.length) throw new Error(errors.join("\n"));
          await page.close();
        }
      }
    }
    await writeFile(path.join(output, "manifest.json"), JSON.stringify({ generated_at: new Date().toISOString(), synthetic: true, images }, null, 2) + "\n");
    await writeFile(path.join(output, "index.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><title>News Stability visual review</title><style>body{font:16px system-ui;margin:2rem;background:#f7f6f2;color:#253531}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:2rem}img{width:100%;max-height:32rem;object-fit:cover;object-position:top;border:1px solid #bbb}a{color:inherit}</style><h1>News Stability visual review</h1><p>Original synthetic content only. Three layouts, three themes, desktop and phone; collection and expanded article. Click a picture for full size.</p><main>${images.map(item => `<figure><a href="${item.name}"><img loading="lazy" src="${item.name}" alt="${item.layout}, ${item.theme}, ${item.width}px, ${item.mode}"></a><figcaption>${item.name}</figcaption></figure>`).join("\n")}</main></html>`);
    const overview = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
    await overview.goto(pathToFileURL(path.join(output, "index.html")).href);
    await overview.addStyleTag({ content: "body{margin:1rem}main{grid-template-columns:repeat(6,minmax(0,1fr));gap:.75rem}figure{margin:0}img{height:200px;object-fit:cover}figcaption{font-size:11px;overflow-wrap:anywhere}" });
    await overview.evaluate(async () => {
      for (const img of document.images) img.loading = "eager";
      await Promise.all([...document.images].map(img => img.decode()));
    });
    await overview.screenshot({ path: path.join(output, "overview.png"), fullPage: true });
    await overview.close();
    console.log(`Wrote ${images.length} screenshots and review gallery: ${path.join(output, "index.html")}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
