import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

interface HashedFile {
  relativePath: string;
  content: Buffer;
}

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function canonicalContent(content: Buffer): Buffer | string {
  if (content.includes(0)) return content;
  try {
    return utf8Decoder.decode(content).replaceAll("\r\n", "\n");
  } catch {
    return content;
  }
}

function comparePaths(left: HashedFile, right: HashedFile): number {
  if (left.relativePath < right.relativePath) return -1;
  if (left.relativePath > right.relativePath) return 1;
  return 0;
}

async function collectFiles(root: string, current: string, files: HashedFile[]): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(root, fullPath, files);
    } else if (entry.isFile()) {
      files.push({
        relativePath: path.relative(root, fullPath).split(path.sep).join("/"),
        content: await readFile(fullPath),
      });
    }
  }
}

export async function hashDirectory(directory: string): Promise<string> {
  const files: HashedFile[] = [];
  await collectFiles(directory, directory, files);
  files.sort(comparePaths);

  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.relativePath);
    hash.update(canonicalContent(file.content));
  }
  return hash.digest("hex");
}

export function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
