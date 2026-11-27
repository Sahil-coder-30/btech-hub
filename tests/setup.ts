/**
 * Test loader. App code uses bundler-style imports ("./grades", "@/lib/session").
 * Node needs real file paths, so this maps them before each test file loads.
 * Run: npm test   (Node 22.18+ for built-in TypeScript and module.registerHooks)
 */
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = fileURLToPath(new URL("../src/", import.meta.url));

registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.includes("/node_modules/")) return next(specifier, context);
    // next has no "exports" map, so "next/server" needs its .js file
    if (/^next\/[a-z-]+$/.test(specifier)) return next(`${specifier}.js`, context);
    let target = specifier;
    if (specifier.startsWith("@/")) target = pathToFileURL(src + specifier.slice(2)).href;
    else if (!specifier.startsWith(".")) return next(specifier, context);
    if (/\.[cm]?[jt]sx?$/.test(target)) return next(target, context);
    const base = new URL(target, context.parentURL).href;
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(fileURLToPath(base + ext))) return next(base + ext, context);
    }
    return next(target, context);
  },
});

process.env.AUTH_SECRET ??= "test-secret-that-is-at-least-32-characters-long";
