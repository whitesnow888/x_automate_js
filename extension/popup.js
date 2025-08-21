document.getElementById("follow").addEventListener("click", () => runAction("follow"));
document.getElementById("unfollow").addEventListener("click", () => runAction("unfollow"));
document.getElementById("like").addEventListener("click", () => runAction("like"));

async function runAction(action) {
    const max = parseInt(document.getElementById("max").value) || 10;
    const delay = parseInt(document.getElementById("delay").value) || 1000;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.url?.includes("x.com") && !tab?.url?.includes("twitter.com")) {
        showStatus("⚠️ Open Twitter/X first!", "error");
        return;
    }

    chrome.tabs.sendMessage(tab.id, { action, max, delay }, (response) => {
        if (response?.success) {
            showStatus(`✅ ${response.message}`, "success");
        } else {
            showStatus(`❌ ${response?.error || "Something went wrong"}`, "error");
        }
    });
}

function showStatus(message, type) {
    const status = document.getElementById("status");
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = "block";
    setTimeout(() => (status.style.display = "none"), 4000);
}
