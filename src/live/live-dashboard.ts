interface DashboardOptions {
  jsonlFile: string;
  sseUrl?: string;
}

export interface LiveReportPageOptions {
  jsonlFile: string;
  sseUrl?: string;
  title?: string;
  theme?: string;
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateLiveDashboard(options: DashboardOptions): string {
  const safeJsonlFile = escapeAttr(options.jsonlFile);
  const sseUrl = options.sseUrl ? escapeAttr(options.sseUrl) : null;

  const dataFetchingScript = sseUrl
    ? `
      const source = new EventSource('${sseUrl}');
      source.onmessage = function(e) {
        try { processEvent(JSON.parse(e.data)); } catch(_) {}
      };`
    : `
      let lastLineCount = 0;
      function poll() {
        fetch('${safeJsonlFile}', { cache: 'no-store' })
          .then(function(r) { return r.text(); })
          .then(function(text) {
            const lines = text.trim().split('\\n');
            for (let i = lastLineCount; i < lines.length; i++) {
              try { processEvent(JSON.parse(lines[i])); } catch(_) {}
            }
            lastLineCount = lines.length;
          })
          .catch(function() {});
      }
      setInterval(poll, 2000);
      poll();`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Live Test Results</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0f172a; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .dot { width: 12px; height: 12px; background: #22c55e; border-radius: 50%; animation: pulse 1.5s ease-in-out infinite; }
  .dot.stopped { animation: none; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  h1 { font-size: 1.5rem; font-weight: 600; }
  .elapsed { margin-left: auto; font-size: 0.875rem; color: #94a3b8; }
  #status-banner { display: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; font-size: 1rem; margin-bottom: 20px; text-align: center; }
  #status-banner.pass { background: #166534; color: #bbf7d0; display: block; }
  #status-banner.fail { background: #991b1b; color: #fecaca; display: block; }
  .progress-track { background: #1e293b; border-radius: 8px; height: 24px; overflow: hidden; display: flex; margin-bottom: 24px; }
  .progress-track .seg { height: 100%; transition: width 0.3s ease; }
  .seg-passed { background: #22c55e; }
  .seg-failed { background: #ef4444; }
  .seg-flaky { background: #eab308; }
  .seg-skipped { background: #64748b; }
  .counters { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .counter-card { background: #1e293b; border-radius: 8px; padding: 16px; text-align: center; }
  .counter-card .value { font-size: 2rem; font-weight: 700; }
  .counter-card .label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; margin-top: 4px; }
  .c-passed .value { color: #22c55e; }
  .c-failed .value { color: #ef4444; }
  .c-flaky .value { color: #eab308; }
  .c-skipped .value { color: #64748b; }
  .failure-section h2 { font-size: 1.125rem; margin-bottom: 12px; }
  .failure-item { background: #1e293b; border-left: 4px solid #ef4444; border-radius: 4px; padding: 12px 16px; margin-bottom: 8px; animation: slideIn 0.3s ease; }
  .failure-item .title { font-weight: 600; }
  .failure-item .file { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }
  .failure-item .error { font-size: 0.8rem; color: #fca5a5; margin-top: 6px; font-family: monospace; white-space: pre-wrap; }
  @keyframes slideIn { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
</style>
</head>
<body>
<div class="header">
  <div class="dot" id="pulse-dot"></div>
  <h1>Live Test Results</h1>
  <span class="elapsed" id="elapsed">0s</span>
</div>
<div id="status-banner"></div>
<div id="progress-bar" style="display:none"></div>
<div class="progress-track" id="progress-track">
  <div class="seg seg-passed" id="seg-passed" style="width:0"></div>
  <div class="seg seg-failed" id="seg-failed" style="width:0"></div>
  <div class="seg seg-flaky" id="seg-flaky" style="width:0"></div>
  <div class="seg seg-skipped" id="seg-skipped" style="width:0"></div>
</div>
<div class="counters">
  <div class="counter-card c-passed"><div class="value" id="counter-passed">0</div><div class="label">Passed</div></div>
  <div class="counter-card c-failed"><div class="value" id="counter-failed">0</div><div class="label">Failed</div></div>
  <div class="counter-card c-flaky"><div class="value" id="counter-flaky">0</div><div class="label">Flaky</div></div>
  <div class="counter-card c-skipped"><div class="value" id="counter-skipped">0</div><div class="label">Skipped</div></div>
</div>
<div class="failure-section">
  <h2>Failures</h2>
  <div id="failure-feed"></div>
</div>
<script>
(function() {
  var startTime = Date.now();
  var elapsedEl = document.getElementById('elapsed');
  var timerRunning = true;
  function tickElapsed() {
    if (!timerRunning) return;
    var s = Math.floor((Date.now() - startTime) / 1000);
    var m = Math.floor(s / 60);
    elapsedEl.textContent = m > 0 ? m + 'm ' + (s % 60) + 's' : s + 's';
    setTimeout(tickElapsed, 1000);
  }
  tickElapsed();

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function updateUI(counters) {
    var total = counters.totalExpected || 1;
    document.getElementById('counter-passed').textContent = counters.passed || 0;
    document.getElementById('counter-failed').textContent = counters.failed || 0;
    document.getElementById('counter-flaky').textContent = counters.flaky || 0;
    document.getElementById('counter-skipped').textContent = counters.skipped || 0;
    document.getElementById('seg-passed').style.width = ((counters.passed || 0) / total * 100) + '%';
    document.getElementById('seg-failed').style.width = ((counters.failed || 0) / total * 100) + '%';
    document.getElementById('seg-flaky').style.width = ((counters.flaky || 0) / total * 100) + '%';
    document.getElementById('seg-skipped').style.width = ((counters.skipped || 0) / total * 100) + '%';
  }

  function addFailure(ev) {
    var feed = document.getElementById('failure-feed');
    var item = document.createElement('div');
    item.className = 'failure-item';
    item.innerHTML = '<div class="title">' + escapeHtml(ev.title || '') + '</div>'
      + '<div class="file">' + escapeHtml(ev.file || '') + '</div>'
      + (ev.error ? '<div class="error">' + escapeHtml(ev.error) + '</div>' : '');
    feed.insertBefore(item, feed.firstChild);
  }

  function onComplete(ev) {
    var banner = document.getElementById('status-banner');
    var failed = (ev.counters && ev.counters.failed) || 0;
    banner.textContent = 'Run complete' + (failed > 0 ? ' \u2014 ' + failed + ' failed' : ' \u2014 all passed');
    banner.className = failed > 0 ? 'fail' : 'pass';
    document.getElementById('pulse-dot').classList.add('stopped');
    timerRunning = false;
    if (ev.counters) updateUI(ev.counters);
  }

  function processEvent(ev) {
    if (ev.event === 'start') {
      startTime = Date.now();
    } else if (ev.event === 'test') {
      if (ev.counters) updateUI(ev.counters);
      if (ev.status === 'failed') addFailure(ev);
    } else if (ev.event === 'complete') {
      onComplete(ev);
    }
  }

  ${dataFetchingScript}
})();
</script>
</body>
</html>`;
}

export function generateLiveReportPage(options: LiveReportPageOptions): string {
  const safeJsonlFile = escapeAttr(options.jsonlFile);
  const safeTitle = escapeAttr(options.title || 'Smart Report');
  const sseUrl = options.sseUrl ? escapeAttr(options.sseUrl) : '__SSE_URL__';

  const dataFetchingScript = options.sseUrl
    ? `
      var sseUrl = '${escapeAttr(options.sseUrl)}';
      var source = new EventSource(sseUrl);
      source.onmessage = function(e) {
        try { processEvent(JSON.parse(e.data)); } catch(_) {}
      };`
    : `
      var sseUrl = '${sseUrl}';
      var useSse = sseUrl !== '__SSE_URL__' && sseUrl.indexOf('__' + 'SSE_URL__') === -1;
      if (useSse) {
        var source = new EventSource(sseUrl);
        source.onmessage = function(e) {
          try { processEvent(JSON.parse(e.data)); } catch(_) {}
        };
      } else {
        var lastLineCount = 0;
        function poll() {
          fetch('${safeJsonlFile}', { cache: 'no-store' })
            .then(function(r) { return r.text(); })
            .then(function(text) {
              var lines = text.trim().split('\\n');
              for (var i = lastLineCount; i < lines.length; i++) {
                try { processEvent(JSON.parse(lines[i])); } catch(_) {}
              }
              lastLineCount = lines.length;
            })
            .catch(function() {});
        }
        setInterval(poll, 2000);
        poll();
      }`;

  return `<!DOCTYPE html>
<html lang="en" data-live-mode>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} — Live</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
  :root {
    --bg-primary: #0f172a;
    --bg-card: #1e293b;
    --text-primary: #e2e8f0;
    --text-secondary: #94a3b8;
    --accent-green: #22c55e;
    --accent-red: #ef4444;
    --accent-yellow: #eab308;
    --accent-slate: #64748b;
    --font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg-primary); color: var(--text-primary); font-family: var(--font-family); padding: 24px; min-height: 100vh; }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .live-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; padding: 4px 10px; font-size: 0.75rem; font-weight: 600; color: #ef4444; text-transform: uppercase; letter-spacing: 0.05em; }
  .live-dot { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; animation: pulse 1.5s ease-in-out infinite; }
  .live-dot.stopped { animation: none; opacity: 0.4; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  h1 { font-size: 1.5rem; font-weight: 700; }
  .elapsed { margin-left: auto; font-size: 0.875rem; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
  #status-banner { display: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; font-size: 1rem; margin-bottom: 20px; text-align: center; }
  #status-banner.pass { background: #166534; color: #bbf7d0; display: block; }
  #status-banner.fail { background: #991b1b; color: #fecaca; display: block; }
  .progress-track { background: var(--bg-card); border-radius: 8px; height: 24px; overflow: hidden; display: flex; margin-bottom: 24px; }
  .progress-track .seg { height: 100%; transition: width 0.3s ease; }
  .seg-passed { background: var(--accent-green); }
  .seg-failed { background: var(--accent-red); }
  .seg-flaky { background: var(--accent-yellow); }
  .seg-skipped { background: var(--accent-slate); }
  .progress-label { text-align: center; font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 24px; margin-top: -16px; }
  .counters { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .counter-card { background: var(--bg-card); border-radius: 8px; padding: 16px; text-align: center; }
  .counter-card .value { font-size: 2rem; font-weight: 700; }
  .counter-card .label { font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase; margin-top: 4px; letter-spacing: 0.05em; }
  .c-passed .value { color: var(--accent-green); }
  .c-failed .value { color: var(--accent-red); }
  .c-flaky .value { color: var(--accent-yellow); }
  .c-skipped .value { color: var(--accent-slate); }
  .failure-section h2 { font-size: 1.125rem; margin-bottom: 12px; }
  .failure-item { background: var(--bg-card); border-left: 4px solid var(--accent-red); border-radius: 4px; padding: 12px 16px; margin-bottom: 8px; animation: slideIn 0.3s ease; }
  .failure-item .title { font-weight: 600; }
  .failure-item .file { font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px; }
  .failure-item .error { font-size: 0.8rem; color: #fca5a5; margin-top: 6px; font-family: monospace; white-space: pre-wrap; max-height: 120px; overflow: hidden; }
  @keyframes slideIn { from { transform: translateX(-20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  .footer { text-align: center; margin-top: 48px; font-size: 0.875rem; color: var(--text-secondary); }
</style>
</head>
<body>
<div class="header">
  <div class="live-badge"><div class="live-dot" id="pulse-dot"></div>Live</div>
  <h1>${safeTitle}</h1>
  <span class="elapsed" id="elapsed">0s</span>
</div>
<div id="status-banner"></div>
<div class="progress-track" id="progress-track">
  <div class="seg seg-passed" id="seg-passed" style="width:0"></div>
  <div class="seg seg-failed" id="seg-failed" style="width:0"></div>
  <div class="seg seg-flaky" id="seg-flaky" style="width:0"></div>
  <div class="seg seg-skipped" id="seg-skipped" style="width:0"></div>
</div>
<div class="progress-label" id="progress-label">0 / 0 tests</div>
<div class="counters">
  <div class="counter-card c-passed"><div class="value" id="counter-passed">0</div><div class="label">Passed</div></div>
  <div class="counter-card c-failed"><div class="value" id="counter-failed">0</div><div class="label">Failed</div></div>
  <div class="counter-card c-flaky"><div class="value" id="counter-flaky">0</div><div class="label">Flaky</div></div>
  <div class="counter-card c-skipped"><div class="value" id="counter-skipped">0</div><div class="label">Skipped</div></div>
</div>
<div class="failure-section">
  <h2>Failures</h2>
  <div id="failure-feed"></div>
</div>
<div class="footer" id="footer">Waiting for tests to complete...</div>
<script>
(function() {
  var startTime = Date.now();
  var elapsedEl = document.getElementById('elapsed');
  var timerRunning = true;
  var totalExpected = 0;
  var completed = 0;
  function tickElapsed() {
    if (!timerRunning) return;
    var s = Math.floor((Date.now() - startTime) / 1000);
    var m = Math.floor(s / 60);
    elapsedEl.textContent = m > 0 ? m + 'm ' + (s % 60) + 's' : s + 's';
    setTimeout(tickElapsed, 1000);
  }
  tickElapsed();

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function updateUI(counters) {
    totalExpected = counters.totalExpected || totalExpected || 1;
    completed = (counters.passed || 0) + (counters.failed || 0) + (counters.flaky || 0) + (counters.skipped || 0);
    document.getElementById('counter-passed').textContent = counters.passed || 0;
    document.getElementById('counter-failed').textContent = counters.failed || 0;
    document.getElementById('counter-flaky').textContent = counters.flaky || 0;
    document.getElementById('counter-skipped').textContent = counters.skipped || 0;
    document.getElementById('seg-passed').style.width = ((counters.passed || 0) / totalExpected * 100) + '%';
    document.getElementById('seg-failed').style.width = ((counters.failed || 0) / totalExpected * 100) + '%';
    document.getElementById('seg-flaky').style.width = ((counters.flaky || 0) / totalExpected * 100) + '%';
    document.getElementById('seg-skipped').style.width = ((counters.skipped || 0) / totalExpected * 100) + '%';
    document.getElementById('progress-label').textContent = completed + ' / ' + totalExpected + ' tests';
  }

  function addFailure(ev) {
    var feed = document.getElementById('failure-feed');
    var item = document.createElement('div');
    item.className = 'failure-item';
    item.innerHTML = '<div class="title">' + escapeHtml(ev.title || '') + '</div>'
      + '<div class="file">' + escapeHtml(ev.file || '') + '</div>'
      + (ev.error ? '<div class="error">' + escapeHtml(ev.error.substring(0, 500)) + '</div>' : '');
    feed.insertBefore(item, feed.firstChild);
  }

  var finalReportAttempts = 0;
  var maxFinalReportAttempts = 60;
  function waitForFinalReport() {
    finalReportAttempts++;
    if (finalReportAttempts > maxFinalReportAttempts) {
      document.getElementById('footer').textContent = 'Report generation timed out. Refresh manually to check.';
      return;
    }
    document.getElementById('footer').textContent = 'Generating report...';
    fetch(window.location.href, { cache: 'no-store', method: 'HEAD' })
      .then(function() { return fetch(window.location.href, { cache: 'no-store' }); })
      .then(function(r) { return r.text(); })
      .then(function(html) {
        if (html && html.indexOf('data-live-mode') === -1) {
          window.location.reload();
        } else {
          setTimeout(waitForFinalReport, 1000);
        }
      })
      .catch(function() { setTimeout(waitForFinalReport, 2000); });
  }

  function onComplete(ev) {
    var banner = document.getElementById('status-banner');
    var failed = (ev.counters && ev.counters.failed) || 0;
    banner.textContent = 'Run complete' + (failed > 0 ? ' \\u2014 ' + failed + ' failed' : ' \\u2014 all passed');
    banner.className = failed > 0 ? 'fail' : 'pass';
    document.getElementById('pulse-dot').classList.add('stopped');
    timerRunning = false;
    if (ev.counters) updateUI(ev.counters);
    setTimeout(waitForFinalReport, 500);
  }

  function processEvent(ev) {
    if (ev.event === 'start') {
      startTime = Date.now();
      totalExpected = ev.totalExpected || 0;
      document.getElementById('progress-label').textContent = '0 / ' + totalExpected + ' tests';
    } else if (ev.event === 'test') {
      if (ev.counters) updateUI(ev.counters);
      if (ev.status === 'failed') addFailure(ev);
    } else if (ev.event === 'complete') {
      onComplete(ev);
    }
  }

  ${dataFetchingScript}
})();
</script>
</body>
</html>`;
}
