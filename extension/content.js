/**
 * Content script for X Auto Follow Tool
 * Supports: follow, unfollow, like
 * Human-like clicks + scroll
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.action) return;

    const max = Number.isFinite(+msg.max) && +msg.max > 0 ? +msg.max : 50;
    const delay = Number.isFinite(+msg.delay) && +msg.delay >= 200 ? +msg.delay : 800;

    if (msg.action === "follow") {
        runAction("follow", max, delay).then(sendResponse);
    } else if (msg.action === "unfollow") {
        runAction("unfollow", max, delay).then(sendResponse);
    } else if (msg.action === "like") {
        runAction("like", max, delay).then(sendResponse);
    } else {
        sendResponse({ success: false, error: "Unknown action" });
    }

    return true; // async
});

/**
 * Core loop: find → click → scroll
 */
async function runAction(type, max, delay) {
    let clicked = 0;
    const seen = new WeakSet();

    while (clicked < max) {
        const btn = findButton(type, seen);

        if (!btn) {
            const loaded = await autoScrollOnce();
            if (!loaded) break;
            continue;
        }

        ensureInView(btn);
        realClick(btn);
        seen.add(btn);

        // --- Special case: confirm unfollow modal ---
        if (type === "unfollow") {
            let confirmBtn = null;
            for (let i = 0; i < 10; i++) { // retry up to ~2s
                await sleep(200);
                confirmBtn = findButton("confirm-unfollow");
                if (confirmBtn) break;
            }

            if (confirmBtn) {
                realClick(confirmBtn);
                // wait for modal to disappear
                await waitForModalToClose();
            }
        }

        clicked++;
        await sleep(applyJitter(delay));
    }

    return { success: true, message: `${type} done on ${clicked}/${max}` };
}

/**
 * Detect if modal closed
 */
async function waitForModalToClose(timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const modal = document.querySelector("[role='dialog']");
        if (!modal) return true;
        await sleep(200);
    }
    return false;
}

/**
 * Find buttons robustly
 */
function findButton(type, seen) {
    const all = [
        ...document.querySelectorAll("button, div[role='button'], [data-testid]")
    ];

    for (const el of all) {
        if (!isVisible(el)) continue;
        if (seen && seen.has(el)) continue;

        const txt = (el.innerText || "").trim().toLowerCase();
        const al = (el.getAttribute("aria-label") || "").toLowerCase();
        const ti = (el.getAttribute("data-testid") || "").toLowerCase();

        switch (type) {
            case "follow":
                if ((txt === "follow" || ti === "follow" || al.startsWith("follow")) &&
                    !txt.includes("following")) return el;
                break;

            case "unfollow":
                if (txt === "following" || ti === "unfollow") return el;
                break;

            case "like":
                if (ti === "like" || al.includes("like this post")) return el;
                break;

            case "confirm-unfollow":
                if ((txt === "unfollow" && !txt.includes("following")) ||
                    ti === "confirmationSheetConfirm") return el;
                break;
        }
    }
    return null;
}

/**
 * Real human-like click simulation
 */
function realClick(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, view: window };

    el.dispatchEvent(new MouseEvent("mouseover", { ...opts, clientX: rect.left + 5, clientY: rect.top + 5 }));
    el.dispatchEvent(new MouseEvent("mousemove", { ...opts, clientX: rect.left + 5, clientY: rect.top + 5 }));
    el.dispatchEvent(new MouseEvent("mousedown", { ...opts, clientX: rect.left + 5, clientY: rect.top + 5 }));
    el.dispatchEvent(new MouseEvent("mouseup", { ...opts, clientX: rect.left + 5, clientY: rect.top + 5 }));
    el.dispatchEvent(new MouseEvent("click", { ...opts, clientX: rect.left + 5, clientY: rect.top + 5 }));
}

/**
 * Helpers
 */
function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2 && el.offsetParent !== null;
}

function ensureInView(el) {
    try {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch { }
}

async function autoScrollOnce() {
    const before = document.body.scrollHeight;
    window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" });
    await sleep(600);
    return document.body.scrollHeight > before;
}

function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

/**
 * Add small random jitter to delay (to look more human)
 */
function applyJitter(ms) {
    const jitter = Math.floor(Math.random() * 200) - 100; // ±100ms
    return Math.max(200, ms + jitter);
}
