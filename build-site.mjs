// Gera o site estático em site/. Não depende de bibliotecas externas.
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SITE = join(ROOT, "site");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

async function main() {
  try {
    await stat(join(ROOT, "dist", "js", "app", "main.js"));
  } catch {
    throw new Error("dist/js não encontrado. Execute 'npm run build:js' antes.");
  }

  await rm(SITE, { recursive: true, force: true });
  await mkdir(SITE, { recursive: true });

  await cp(join(ROOT, "index.html"), join(SITE, "index.html"));
  await cp(join(ROOT, "public", "styles.css"), join(SITE, "styles.css"));
  await cp(join(ROOT, "public", "manifest.webmanifest"), join(SITE, "manifest.webmanifest"));
  await cp(join(ROOT, "public", "icons"), join(SITE, "icons"), {
    recursive: true,
    filter: (src) => !src.endsWith(".svg"),
  });
  await cp(join(ROOT, "dist", "js"), join(SITE, "js"), { recursive: true });

  const files = (await walk(SITE)).sort();
  const hash = createHash("sha256");
  const assets = ["./", "./index.html"];
  for (const file of files) {
    const rel = relative(SITE, file).split(sep).join("/");
    hash.update(rel);
    hash.update(await readFile(file));
    if (rel !== "index.html") assets.push(`./${rel}`);
  }
  const version = hash.digest("hex").slice(0, 12);

  const template = await readFile(join(ROOT, "public", "sw.template.js"), "utf8");
  const sw = template
    .replace("__VERSION__", version)
    .replace("__ASSETS__", JSON.stringify(assets, null, 2));
  await writeFile(join(SITE, "sw.js"), sw, "utf8");

  console.log(`site gerado em ${relative(ROOT, SITE)}/ (${assets.length} recursos, versão ${version})`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
