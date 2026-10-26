import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copies the Draco decoder files bundled with three.js into public/draco/ so
 * the app never depends on a CDN. Runs before dev, before build and after
 * install.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs', 'draco');
const target = join(root, 'public', 'draco');

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(source))) {
    console.warn('[draco] three.js is not installed yet — skipping decoder copy.');
    return;
  }

  await mkdir(target, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    await copyFile(join(source, entry.name), join(target, entry.name));
  }

  console.log(`[draco] copied ${entries.length} decoder files to public/draco/`);
}

main().catch((error) => {
  console.error('[draco] failed to copy decoders:', error);
  process.exitCode = 1;
});
