function $(id) {
  return document.getElementById(id);
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

function renderLogs(logs) {
  if (!Array.isArray(logs) || !logs.length) return "—";
  return logs
    .map(l => `${l.ts} [${l.level}] ${l.message}${l.meta ? " " + JSON.stringify(l.meta) : ""}`)
    .join("\n");
}

async function apiGet(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

async function loadState() {
  try {
    const state = await apiGet("/api/state");
    const counts = state.counts || {};
    $("state").textContent = `raw_topics: ${counts.raw_topics ?? "?"} | top_topics: ${counts.top_topics ?? "?"} | final_tweets: ${counts.final_tweets ?? "?"}`;
  } catch (e) {
    $("state").textContent = `Error: ${e.message}`;
  }
}

async function loadDashboard() {
  const data = await apiGet("/api/today");

  const container = $("container");
  container.innerHTML = "";

  if (!Array.isArray(data) || !data.length) {
    container.innerHTML = `<div class="muted">No tweets ready yet.</div>`;
    return;
  }

  data.forEach(topic => {
    const div = document.createElement("div");
    div.className = "topic";

    const variants = Array.isArray(topic.tweet_variants) ? topic.tweet_variants : [];

    div.innerHTML = `
      <h3>${topic.topic}</h3>
      <p class="muted">Tags: ${(topic.tags || []).join(", ") || "—"}</p>
      ${variants
        .map(
          (v, i) => `
        <div class="variant">
          <b>Tweet ${i + 1}</b>
          <p>${escapeHtml(v.tweet || "")}</p>

          <p class="small"><b>Image:</b> ${escapeHtml(v.image_keyword || "—")}</p>
          <p class="small"><b>Retweet:</b> ${escapeHtml(v.retweet_account || "—")}</p>
          <p class="small"><b>Hashtags:</b> ${(v.hashtags || []).join(" ")}</p>
          <p class="small"><b>Quote:</b> ${escapeHtml(v.quote_comment || "—")}</p>

          <button onclick="copyText(${JSON.stringify(v.tweet || "")})">Copy Tweet</button>
          <button onclick="copyText(${JSON.stringify(v.image_keyword || "")})">Copy Image Keyword</button>
        </div>
      `
        )
        .join("")}
    `;

    container.appendChild(div);
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.copyText = function copyText(text) {
  navigator.clipboard.writeText(String(text || ""));
  alert("Copied!");
};

window.runStep = async function runStep(stepNo) {
  const out = $("out" + stepNo);
  const log = $("log" + stepNo);
  out.textContent = "Running…";
  log.textContent = "—";

  try {
    const body = {};
    if (stepNo === 3) body.mode = $("step3mode").value;

    const data = await apiPost(`/api/steps/${stepNo}`, body);
    out.textContent = pretty(data.result);
    log.textContent = renderLogs(data.logs);

    await loadState();
    if (stepNo >= 3) await loadDashboard();
  } catch (e) {
    out.textContent = `Error: ${e.message}`;
  }
};

$("btnRefreshTweets").addEventListener("click", () => loadDashboard());
$("btnRefreshState").addEventListener("click", () => loadState());

loadState();
loadDashboard();
