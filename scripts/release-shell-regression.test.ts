import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import nextConfig from "../apps/many-lives-web/next.config.ts";
import {
  CHUNK_LOAD_RECOVERY_SCRIPT,
  CHUNK_LOAD_RECOVERY_STORAGE_KEY,
} from "../apps/many-lives-web/src/app/chunkLoadRecovery.ts";

const rootPageSource = readFileSync(
  new URL("../apps/many-lives-web/src/app/page.tsx", import.meta.url),
  "utf8",
);
const rootLayoutSource = readFileSync(
  new URL("../apps/many-lives-web/src/app/layout.tsx", import.meta.url),
  "utf8",
);

test("root HTML is dynamic and explicitly excluded from shared caches", async () => {
  assert.match(rootPageSource, /export const dynamic = "force-dynamic"/);
  assert.match(rootPageSource, /export const revalidate = 0/);

  const configuredHeaders = await nextConfig.headers?.();
  const rootHeaders = configuredHeaders?.find(
    (entry) => "source" in entry && entry.source === "/",
  );
  const cacheControl = rootHeaders?.headers.find(
    (header) => header.key.toLowerCase() === "cache-control",
  )?.value;

  assert.equal(
    cacheControl,
    "private, no-cache, no-store, max-age=0, must-revalidate",
  );
  assert.doesNotMatch(cacheControl ?? "", /s-maxage/i);
  assert.match(rootLayoutSource, /CHUNK_LOAD_RECOVERY_SCRIPT/);
  assert.match(
    rootLayoutSource,
    /<script[\s\S]*dangerouslySetInnerHTML=\{\{ __html: CHUNK_LOAD_RECOVERY_SCRIPT \}\}/,
  );
  assert.doesNotMatch(rootLayoutSource, /from "next\/script"/);
});

test("chunk recovery reloads once without changing URL or saved identity", () => {
  const sessionStorage = createStorage();
  const localStorage = createStorage([
    ["many-lives:street-game-id", "game-preserved"],
  ]);
  const href =
    "https://manylives-sim.branavan.com/?gameId=game-preserved&autoplay=1";

  const first = createBrowser({ href, localStorage, sessionStorage });
  first.dispatch("unhandledrejection", chunkFailureEvent());

  assert.equal(first.reloadCount(), 1);
  assert.equal(first.window.location.href, href);
  assert.equal(
    localStorage.getItem("many-lives:street-game-id"),
    "game-preserved",
  );
  assert.equal(
    JSON.parse(
      sessionStorage.getItem(CHUNK_LOAD_RECOVERY_STORAGE_KEY) ?? "null",
    ).href,
    href,
  );

  const repeated = createBrowser({ href, localStorage, sessionStorage });
  repeated.dispatch("unhandledrejection", chunkFailureEvent());

  assert.equal(repeated.reloadCount(), 0);
  assert.match(
    nodeText(repeated.document.body),
    /South Quay needs a fresh connection/,
  );
  assert.match(nodeText(repeated.document.body), /saved run.*not been changed/i);
  assert.equal(repeated.window.location.href, href);
  assert.equal(
    localStorage.getItem("many-lives:street-game-id"),
    "game-preserved",
  );
});

test("fresh-run URLs show recovery instead of automatically creating again", () => {
  const localStorage = createStorage([
    ["many-lives:street-game-id", "game-before-recovery"],
  ]);
  const browser = createBrowser({
    href: "https://manylives-sim.branavan.com/?new=1&autoplay=1",
    localStorage,
    sessionStorage: createStorage(),
  });

  browser.dispatch("error", {
    message: "Script error.",
    preventDefault() {},
    target: {
      src: "https://manylives-sim.branavan.com/_next/static/chunks/old.js",
    },
  });

  assert.equal(browser.reloadCount(), 0);
  assert.match(nodeText(browser.document.body), /Retry loading/);
  assert.equal(
    localStorage.getItem("many-lives:street-game-id"),
    "game-before-recovery",
  );

  const retry = findNodeByAttribute(
    browser.document.body,
    "data-chunk-recovery-retry",
  );
  assert.ok(retry, "Expected a usable recovery retry button.");
  retry.dispatch("click");
  assert.equal(browser.reloadCount(), 1);
});

function chunkFailureEvent() {
  return {
    preventDefault() {},
    reason: new Error(
      "ChunkLoadError: Loading chunk 161 failed (/\u005fnext/static/chunks/old.js)",
    ),
  };
}

function createStorage(initial: Array<[string, string]> = []) {
  const values = new Map(initial);
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

type FakeNode = ReturnType<typeof createNode>;

function createNode(tagName: string) {
  const listeners = new Map<string, Array<() => void>>();
  return {
    attributes: new Map<string, string>(),
    children: [] as FakeNode[],
    style: { cssText: "" },
    tagName,
    textContent: "",
    type: "",
    addEventListener(type: string, listener: () => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    append(...children: FakeNode[]) {
      this.children.push(...children);
    },
    dispatch(type: string) {
      for (const listener of listeners.get(type) ?? []) {
        listener();
      }
    },
    replaceChildren(...children: FakeNode[]) {
      this.children = children;
    },
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
    },
  };
}

function createBrowser({
  href,
  localStorage,
  sessionStorage,
}: {
  href: string;
  localStorage: ReturnType<typeof createStorage>;
  sessionStorage: ReturnType<typeof createStorage>;
}) {
  const windowListeners = new Map<string, Array<(event: unknown) => void>>();
  const documentListeners = new Map<string, Array<() => void>>();
  const timers: Array<() => void> = [];
  let reloads = 0;
  const body = createNode("body");
  const document = {
    body,
    readyState: "complete",
    title: "Many Lives",
    addEventListener(type: string, listener: () => void) {
      documentListeners.set(type, [
        ...(documentListeners.get(type) ?? []),
        listener,
      ]);
    },
    createElement(tagName: string) {
      return createNode(tagName);
    },
  };
  const window = {
    localStorage,
    sessionStorage,
    location: {
      href,
      reload() {
        reloads += 1;
      },
    },
    addEventListener(
      type: string,
      listener: (event: unknown) => void,
    ) {
      windowListeners.set(type, [
        ...(windowListeners.get(type) ?? []),
        listener,
      ]);
    },
    setTimeout(listener: () => void) {
      timers.push(listener);
      return timers.length;
    },
  };

  vm.runInNewContext(CHUNK_LOAD_RECOVERY_SCRIPT, {
    Date,
    JSON,
    Set,
    URL,
    document,
    window,
  });

  return {
    document,
    window,
    dispatch(type: string, event: unknown) {
      for (const listener of windowListeners.get(type) ?? []) {
        listener(event);
      }
    },
    reloadCount() {
      return reloads;
    },
    timers,
  };
}

function nodeText(node: FakeNode): string {
  return [node.textContent, ...node.children.map(nodeText)].join(" ");
}

function findNodeByAttribute(
  node: FakeNode,
  attribute: string,
): FakeNode | null {
  if (node.attributes.has(attribute)) {
    return node;
  }
  for (const child of node.children) {
    const match = findNodeByAttribute(child, attribute);
    if (match) {
      return match;
    }
  }
  return null;
}
