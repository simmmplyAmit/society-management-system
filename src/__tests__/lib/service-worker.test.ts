import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";

type Listener = (event: Record<string, unknown>) => void;

/** Runs public/sw.js against a fake worker environment and returns what it registered. */
function loadWorker(opts: { online: boolean; cached?: Record<string, string> }) {
  const listeners: Record<string, Listener> = {};
  const store = new Map<string, string>(Object.entries(opts.cached ?? {}));
  const cacheApi = {
    open: vi.fn(async () => ({
      addAll: vi.fn(async (urls: string[]) => urls.forEach((u) => store.set(u, `cached:${u}`))),
      put: vi.fn(async (req: { url: string }) => void store.set(new URL(req.url).pathname, "put")),
    })),
    match: vi.fn(async (req: string | { url: string }) => {
      const key = typeof req === "string" ? req : new URL(req.url).pathname;
      return store.has(key) ? store.get(key) : undefined;
    }),
    keys: vi.fn(async () => ["ms-static-v0", "ms-static-v1"]),
    delete: vi.fn(async () => true),
  };
  const fetchMock = vi.fn(async (req: { url: string }) => {
    if (!opts.online) throw new TypeError("offline");
    return { ok: true, url: req.url, clone: () => ({ ok: true }) };
  });
  const self = {
    location: { origin: "https://app.example" },
    addEventListener: (type: string, fn: Listener) => void (listeners[type] = fn),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), { self, caches: cacheApi, fetch: fetchMock, URL, Promise });
  return { listeners, cacheApi, fetchMock, store };
}

const fetchEvent = (url: string, init: { method?: string; mode?: string } = {}) => {
  let response: Promise<unknown> | undefined;
  return {
    event: { request: { url, method: init.method ?? "GET", mode: init.mode ?? "no-cors" }, respondWith: (p: Promise<unknown>) => void (response = p) },
    result: () => response,
  };
};

describe("service worker", () => {
  it("pre-caches the offline page and icons on install", async () => {
    const { listeners, store } = loadWorker({ online: true });
    let done: Promise<unknown> | undefined;
    listeners.install({ waitUntil: (p: Promise<unknown>) => void (done = p) });
    await done;
    expect(store.has("/offline.html")).toBe(true);
    expect(store.has("/icons/icon-192x192.png")).toBe(true);
  });

  it("removes old caches on activate", async () => {
    const { listeners, cacheApi } = loadWorker({ online: true });
    let done: Promise<unknown> | undefined;
    listeners.activate({ waitUntil: (p: Promise<unknown>) => void (done = p) });
    await done;
    expect(cacheApi.delete).toHaveBeenCalledWith("ms-static-v0");
    expect(cacheApi.delete).not.toHaveBeenCalledWith("ms-static-v1");
  });

  it("sends page loads to the network and never caches them", async () => {
    const { listeners, cacheApi } = loadWorker({ online: true });
    const f = fetchEvent("https://app.example/dashboard/complaints", { mode: "navigate" });
    listeners.fetch(f.event);
    await f.result();
    expect(cacheApi.open).not.toHaveBeenCalled();
  });

  it("shows the offline page when a page load fails", async () => {
    const { listeners } = loadWorker({ online: false, cached: { "/offline.html": "offline-page" } });
    const f = fetchEvent("https://app.example/dashboard", { mode: "navigate" });
    listeners.fetch(f.event);
    expect(await f.result()).toBe("offline-page");
  });

  it("serves hashed static files from the cache first", async () => {
    const { listeners, fetchMock } = loadWorker({ online: true, cached: { "/_next/static/chunks/app.js": "cached-js" } });
    const f = fetchEvent("https://app.example/_next/static/chunks/app.js");
    listeners.fetch(f.event);
    expect(await f.result()).toBe("cached-js");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves everything else alone: API calls, documents, other hosts, non-GET requests", () => {
    const { listeners } = loadWorker({ online: true });
    for (const f of [
      fetchEvent("https://app.example/api/documents/abc"),
      fetchEvent("https://app.example/api/me/export"),
      fetchEvent("https://app.example/dashboard/maintenance?_rsc=1"),
      fetchEvent("https://files.r2.cloudflarestorage.com/x.pdf"),
      fetchEvent("https://app.example/_next/static/a.js", { method: "POST" }),
    ]) {
      listeners.fetch(f.event);
      expect(f.result()).toBeUndefined();
    }
  });
});
