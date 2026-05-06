import { getPreferenceValues } from "@raycast/api";
import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { basename } from "path";

const HOME = homedir();
const FALLBACK_CLI = "/Applications/Cling.app/Contents/SharedSupport/ClingCLI";

let cachedCLI: string | null = null;

export function resolveClingCLI(): string {
  if (cachedCLI) return cachedCLI;
  try {
    const stdout = execFileSync("/bin/ps", ["-Axo", "comm="], { encoding: "utf-8" });
    const line = stdout.split("\n").find((l) => l.includes("/Cling.app/Contents/MacOS/"));
    if (line) {
      const marker = "/Cling.app";
      const end = line.indexOf(marker) + marker.length;
      const bundle = line.slice(0, end);
      cachedCLI = `${bundle}/Contents/SharedSupport/ClingCLI`;
      return cachedCLI;
    }
  } catch {
    // fall through
  }
  cachedCLI = FALLBACK_CLI;
  return cachedCLI;
}

export function clingInstalled(): boolean {
  return existsSync(resolveClingCLI());
}

const defaultsCache = new Map<string, string | undefined>();

export function getClingDefault(key: string): string | undefined {
  if (defaultsCache.has(key)) return defaultsCache.get(key);
  let result: string | undefined;
  try {
    result = execFileSync("defaults", ["read", "com.lowtechguys.Cling", key], { encoding: "utf-8" }).trim();
  } catch {
    result = undefined;
  }
  defaultsCache.set(key, result);
  return result;
}

const SHELF_BUNDLE_IDS = [
  "at.EternalStorms.Yoink",
  "at.EternalStorms.Yoink-setapp",
  "me.damir.dropover-mac",
  "com.hachipoo.Dockside",
];

let detectedShelfApp: { value: string | undefined } | null = null;

function detectShelfApp(): string | undefined {
  if (detectedShelfApp) return detectedShelfApp.value;
  let value: string | undefined;
  for (const bundleID of SHELF_BUNDLE_IDS) {
    try {
      const result = execFileSync("mdfind", [`kMDItemCFBundleIdentifier == '${bundleID}'`], {
        encoding: "utf-8",
      }).trim();
      if (result) {
        value = result.split("\n")[0];
        break;
      }
    } catch {
      continue;
    }
  }
  detectedShelfApp = { value };
  return value;
}

const VSCODE_PATHS = [
  "/Applications/Visual Studio Code.app",
  "/Applications/Visual Studio Code - Insiders.app",
  `${HOME}/Applications/Visual Studio Code.app`,
  `${HOME}/Applications/Visual Studio Code - Insiders.app`,
];

const TERMINAL_FALLBACKS = ["/System/Applications/Utilities/Terminal.app", "/Applications/Utilities/Terminal.app"];

const TEXT_EDIT_FALLBACKS = ["/System/Applications/TextEdit.app", "/Applications/TextEdit.app"];

export type AppRef = { name: string; path: string | undefined };

function fromPath(path: string): AppRef {
  return { name: basename(path, ".app"), path };
}

function findApp(paths: string[]): AppRef | undefined {
  const path = paths.find((p) => existsSync(p));
  return path ? fromPath(path) : undefined;
}

let cachedEditor: { value: AppRef } | null = null;
let cachedTerminal: { value: AppRef } | null = null;
let cachedShelf: { value: AppRef | undefined } | null = null;

export function getTerminalApp(): AppRef {
  if (cachedTerminal) return cachedTerminal.value;
  const prefs = getPreferenceValues<Preferences>();
  let value: AppRef;
  if (prefs.terminalApp) {
    value = { name: prefs.terminalApp.name, path: prefs.terminalApp.path };
  } else {
    const def = getClingDefault("terminalApp");
    value = def ? fromPath(def) : (findApp(TERMINAL_FALLBACKS) ?? { name: "Terminal", path: undefined });
  }
  cachedTerminal = { value };
  return value;
}

export function getEditorApp(): AppRef {
  if (cachedEditor) return cachedEditor.value;
  const prefs = getPreferenceValues<Preferences>();
  let value: AppRef;
  if (prefs.editorApp) {
    value = { name: prefs.editorApp.name, path: prefs.editorApp.path };
  } else {
    const def = getClingDefault("editorApp");
    value = (def ? fromPath(def) : undefined) ??
      findApp(VSCODE_PATHS) ??
      findApp(TEXT_EDIT_FALLBACKS) ?? { name: "TextEdit", path: undefined };
  }
  cachedEditor = { value };
  return value;
}

export function getShelfApp(): AppRef | undefined {
  if (cachedShelf) return cachedShelf.value;
  const prefs = getPreferenceValues<Preferences>();
  let value: AppRef | undefined;
  if (prefs.shelfApp) {
    value = { name: prefs.shelfApp.name, path: prefs.shelfApp.path };
  } else {
    const def = getClingDefault("shelfApp");
    if (def) {
      value = fromPath(def);
    } else {
      const detected = detectShelfApp();
      value = detected ? fromPath(detected) : undefined;
    }
  }
  cachedShelf = { value };
  return value;
}

export const NOT_INSTALLED_MARKDOWN = `# Cling is not installed

This Raycast extension is a frontend for the [Cling](https://lowtechguys.com/cling) app, which provides the indexing and search backend.

## Install

1. Download Cling from [lowtechguys.com/cling](https://lowtechguys.com/cling) (or via Homebrew: \`brew install --cask thelowtechguys-cling\`).
2. Move \`Cling.app\` to \`/Applications\` or \`~/Applications\`.
3. Launch it once and let it finish the initial index.
4. Install its CLI from Cling's settings (Search > Command Line Tool).
4. Re-run this command.
`;
