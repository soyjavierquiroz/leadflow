import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const appRoot = path.join(webRoot, "app");
const serverExtensions = new Set([".ts", ".tsx"]);

type Finding = {
  file: string;
  line: number;
  snippet: string;
};

const collectFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectFiles(absolutePath);
    }

    if (!serverExtensions.has(path.extname(entry.name))) {
      return [];
    }

    if (entry.name.endsWith(".spec.ts") || entry.name.endsWith(".spec.tsx")) {
      return [];
    }

    return [absolutePath];
  });

const hasUseClientDirective = (source: string) =>
  /^\s*(?:(?:\/\/.*|\/\*[\s\S]*?\*\/)\s*)*["']use client["'];/.test(source);

const findRelativeServerFetches = (): Finding[] => {
  const forbiddenCallPattern = /\b(?:fetch|apiFetch)\s*\(\s*(["'`])\/(?!\/)/g;

  return collectFiles(appRoot).flatMap((absolutePath) => {
    const source = readFileSync(absolutePath, "utf8");

    if (hasUseClientDirective(source)) {
      return [];
    }

    return [...source.matchAll(forbiddenCallPattern)].map((match) => {
      const line = source.slice(0, match.index).split("\n").length;

      return {
        file: path.relative(webRoot, absolutePath),
        line,
        snippet: source.split("\n")[line - 1]?.trim() ?? "",
      };
    });
  });
};

describe("server fetch policy", () => {
  it("keeps Server Components, Server Actions, and Route Handlers off relative fetch URLs", () => {
    expect(findRelativeServerFetches()).toEqual([]);
  });

  it("keeps the member CRM SSR inbox loader on the authenticated API helper", () => {
    const sharedModule = readFileSync(
      path.join(webRoot, "lib/member-crm.ts"),
      "utf8",
    );
    const serverModule = readFileSync(
      path.join(webRoot, "lib/member-crm.server.ts"),
      "utf8",
    );

    expect(sharedModule).not.toMatch(/fetch\s*\(\s*buildAdvisorCrmInboxPath/);
    expect(serverModule).toMatch(
      /apiFetchWithSession\s*\(\s*buildAdvisorCrmInboxPath\(params\)/,
    );
  });
});
