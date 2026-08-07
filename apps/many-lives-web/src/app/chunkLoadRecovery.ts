export const CHUNK_LOAD_RECOVERY_STORAGE_KEY =
  "many-lives:chunk-load-recovery";

export const CHUNK_LOAD_RECOVERY_SCRIPT = String.raw`
(() => {
  const recoveryKey = "many-lives:chunk-load-recovery";
  const recoveryWindowMs = 120000;
  const healthyClearDelayMs = 30000;
  const currentHref = window.location.href;
  let handled = false;

  function isChunkLoadFailure(event) {
    const reason = event && (event.reason || event.error);
    const target = event && event.target;
    const resourceUrl =
      target && typeof target.src === "string" ? target.src : "";
    const detail = [
      reason && reason.name,
      reason && reason.message,
      event && event.message,
      resourceUrl,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      resourceUrl.includes("/_next/static/chunks/") ||
      /ChunkLoadError|Loading chunk [^ ]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
        detail,
      )
    );
  }

  function hasFreshRunIntent() {
    try {
      const search = new URL(currentHref).searchParams;
      const truthy = new Set(["1", "true", "yes", "on"]);
      return ["new", "newGame", "reset"].some((name) =>
        truthy.has((search.get(name) || "").toLowerCase()),
      );
    } catch {
      return false;
    }
  }

  function readRecoveryAttempt() {
    try {
      const raw = window.sessionStorage.getItem(recoveryKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function renderRecoverySurface() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", renderRecoverySurface, {
        once: true,
      });
      return;
    }

    document.title = "Reconnect to Many Lives";

    const shell = document.createElement("main");
    shell.setAttribute("data-chunk-recovery-surface", "true");
    shell.setAttribute("role", "alert");
    shell.style.cssText =
      "min-height:100vh;display:grid;place-items:center;padding:24px;background:#141c21;color:#f2eadb;font-family:'Avenir Next','Segoe UI',sans-serif;";

    const panel = document.createElement("section");
    panel.style.cssText =
      "width:min(100%,520px);padding:28px;border:1px solid #8797a1;border-radius:8px;background:#1d272d;box-shadow:0 18px 50px rgba(0,0,0,.34);";

    const label = document.createElement("p");
    label.textContent = "CONNECTION RECOVERY";
    label.style.cssText =
      "margin:0 0 10px;color:#c4a06a;font:600 12px/1.4 'SFMono-Regular','Menlo',monospace;letter-spacing:0;";

    const title = document.createElement("h1");
    title.textContent = "South Quay needs a fresh connection";
    title.style.cssText =
      "margin:0 0 12px;color:#f2eadb;font:600 30px/1.15 'Iowan Old Style','Palatino Linotype',serif;letter-spacing:0;";

    const copy = document.createElement("p");
    copy.textContent =
      "The game files changed while this page was loading. Your saved run and this page address have not been changed.";
    copy.style.cssText =
      "margin:0 0 22px;color:#cbc0b0;font-size:16px;line-height:1.55;";

    const retry = document.createElement("button");
    retry.type = "button";
    retry.setAttribute("data-chunk-recovery-retry", "true");
    retry.textContent = "Retry loading";
    retry.style.cssText =
      "min-height:44px;padding:10px 16px;border:1px solid #deba80;border-radius:6px;background:#deba80;color:#18120b;font:700 15px/1 'Avenir Next','Segoe UI',sans-serif;cursor:pointer;";
    retry.addEventListener("click", () => window.location.reload());

    panel.append(label, title, copy, retry);
    shell.append(panel);
    document.body.replaceChildren(shell);
  }

  function handleChunkLoadFailure(event) {
    if (handled || !isChunkLoadFailure(event)) {
      return;
    }
    handled = true;
    event.preventDefault && event.preventDefault();

    const previous = readRecoveryAttempt();
    const isRepeatedFailure = Boolean(
      previous &&
        previous.href === currentHref &&
        Date.now() - previous.at < recoveryWindowMs,
    );

    if (hasFreshRunIntent() || isRepeatedFailure) {
      renderRecoverySurface();
      return;
    }

    try {
      window.sessionStorage.setItem(
        recoveryKey,
        JSON.stringify({ at: Date.now(), href: currentHref }),
      );
    } catch {
      renderRecoverySurface();
      return;
    }

    window.location.reload();
  }

  window.addEventListener("error", handleChunkLoadFailure, true);
  window.addEventListener("unhandledrejection", handleChunkLoadFailure);
  window.addEventListener(
    "load",
    () => {
      window.setTimeout(() => {
        const previous = readRecoveryAttempt();
        if (previous && previous.href === currentHref) {
          try {
            window.sessionStorage.removeItem(recoveryKey);
          } catch {
            // Storage can be unavailable without affecting a healthy page.
          }
        }
      }, healthyClearDelayMs);
    },
    { once: true },
  );
})();`;
