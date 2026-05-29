import fs from 'fs';
import { Router, Response, Request } from 'express';

const router = Router();
const LOG_FILE = process.env.ACTIVITY_LOG || '/var/log/mechatronics/activity.log';
const MAX_LINES = 2000;

interface LogEntry {
  ts: string;
  userId: string | null;
  email: string | null;
  role: string | null;
  method: string;
  path: string;
  status: number;
  ms: number;
  ip: string;
  body: unknown;
}

function readLastLines(filePath: string, n: number): LogEntry[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n').filter(Boolean);
  return lines
    .slice(-n)
    .reverse()
    .map(l => {
      try { return JSON.parse(l) as LogEntry; } catch { return null; }
    })
    .filter(Boolean) as LogEntry[];
}

router.get('/', (req: Request, res: Response) => {
  const entries = readLastLines(LOG_FILE, MAX_LINES);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Activity Log — MechatronicsOE</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; font-size: 14px; }
  header { padding: 20px 24px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 12px; }
  header h1 { font-size: 18px; font-weight: 600; }
  header span { font-size: 12px; color: #94a3b8; }
  .filters { padding: 16px 24px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .filters input, .filters select { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 6px 10px; border-radius: 6px; font-size: 13px; }
  .filters input { width: 200px; }
  .filters button { background: #3b82f6; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
  .filters button:hover { background: #2563eb; }
  .stats { padding: 12px 24px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; gap: 24px; font-size: 13px; color: #94a3b8; }
  .stats b { color: #e2e8f0; }
  .wrap { padding: 16px 24px; overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1e293b; color: #94a3b8; text-align: left; padding: 8px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #334155; position: sticky; top: 0; z-index: 1; }
  tr.main-row { cursor: default; }
  tr.main-row.has-body { cursor: pointer; }
  tr.main-row.has-body:hover td { background: #1e293b; }
  td { padding: 7px 12px; border-bottom: 1px solid #161f2e; white-space: nowrap; }
  tr.payload-row td { padding: 0; border-bottom: 1px solid #334155; }
  tr.payload-row pre { background: #0a111e; color: #7dd3fc; font-family: monospace; font-size: 12px; padding: 12px 24px; white-space: pre-wrap; word-break: break-all; max-height: 300px; overflow-y: auto; border-left: 3px solid #3b82f6; }
  .m-GET    { color: #34d399; font-weight: 600; }
  .m-POST   { color: #60a5fa; font-weight: 600; }
  .m-PUT, .m-PATCH { color: #fbbf24; font-weight: 600; }
  .m-DELETE { color: #f87171; font-weight: 600; }
  .s-2 { color: #34d399; }
  .s-3 { color: #60a5fa; }
  .s-4 { color: #fbbf24; }
  .s-5 { color: #f87171; }
  .path { color: #a78bfa; font-family: monospace; font-size: 13px; }
  .anon { color: #64748b; font-style: italic; }
  .role { font-size: 11px; background: #334155; padding: 2px 6px; border-radius: 4px; }
  .slow { color: #fbbf24; }
  .chevron { color: #64748b; font-size: 11px; margin-right: 4px; transition: transform .15s; display: inline-block; }
  .chevron.open { transform: rotate(90deg); color: #60a5fa; }
  .has-body .path-cell { display: flex; align-items: center; }
</style>
</head>
<body>
<header>
  <h1>Activity Log</h1>
  <span>Last ${entries.length} API requests</span>
</header>
<div class="filters">
  <input id="f-email" placeholder="Filter by email…" oninput="applyFilters()">
  <input id="f-path" placeholder="Filter by endpoint…" oninput="applyFilters()">
  <select id="f-method" onchange="applyFilters()">
    <option value="">All methods</option>
    <option>GET</option><option>POST</option><option>PUT</option><option>PATCH</option><option>DELETE</option>
  </select>
  <select id="f-status" onchange="applyFilters()">
    <option value="">All statuses</option>
    <option value="2">2xx success</option>
    <option value="4">4xx client error</option>
    <option value="5">5xx server error</option>
  </select>
  <select id="f-payload" onchange="applyFilters()">
    <option value="">All requests</option>
    <option value="1">With payload only</option>
  </select>
  <button onclick="clearFilters()">Clear</button>
</div>
<div class="stats" id="stats"></div>
<div class="wrap">
<table>
<thead>
  <tr>
    <th>Time</th>
    <th>User</th>
    <th>Role</th>
    <th>Method</th>
    <th>Endpoint</th>
    <th>Status</th>
    <th>ms</th>
    <th>IP</th>
  </tr>
</thead>
<tbody id="tbody"></tbody>
</table>
</div>
<script>
const DATA = ${JSON.stringify(entries)};

function fmt(ts) {
  return new Date(ts).toLocaleString('el-GR', { timeZone: 'Europe/Athens' });
}

function statusClass(s) { return 's-' + String(s)[0]; }

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function togglePayload(idx) {
  const pr = document.getElementById('payload-' + idx);
  const ch = document.getElementById('ch-' + idx);
  if (!pr) return;
  const hidden = pr.style.display === 'none' || pr.style.display === '';
  pr.style.display = hidden ? 'table-row' : 'none';
  ch.classList.toggle('open', hidden);
}

function render(rows) {
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = rows.map((r, i) => {
    const hasBody = r.body !== null && r.body !== undefined;
    const chevron = hasBody ? \`<span class="chevron" id="ch-\${i}">▶</span>\` : '';
    const mainRow = \`
      <tr class="main-row\${hasBody ? ' has-body' : ''}" \${hasBody ? 'onclick="togglePayload('+i+')"' : ''}>
        <td>\${fmt(r.ts)}</td>
        <td>\${r.email ? r.email : '<span class="anon">anonymous</span>'}</td>
        <td>\${r.role ? '<span class="role">'+r.role+'</span>' : ''}</td>
        <td><span class="m-\${r.method}">\${r.method}</span></td>
        <td class="path">\${chevron}\${r.path}</td>
        <td class="\${statusClass(r.status)}">\${r.status}</td>
        <td class="\${r.ms > 500 ? 'slow' : ''}">\${r.ms}</td>
        <td>\${r.ip}</td>
      </tr>\`;
    const payloadRow = hasBody ? \`
      <tr class="payload-row" id="payload-\${i}" style="display:none">
        <td colspan="8"><pre>\${escHtml(JSON.stringify(r.body, null, 2))}</pre></td>
      </tr>\` : '';
    return mainRow + payloadRow;
  }).join('');

  const unique = new Set(rows.map(r => r.email).filter(Boolean)).size;
  const errors = rows.filter(r => r.status >= 400).length;
  const withPayload = rows.filter(r => r.body).length;
  document.getElementById('stats').innerHTML =
    '<span>Showing <b>'+rows.length+'</b> requests</span>' +
    '<span>Unique users: <b>'+unique+'</b></span>' +
    '<span>Errors: <b>'+errors+'</b></span>' +
    '<span>With payload: <b>'+withPayload+'</b></span>';
}

function applyFilters() {
  const email   = document.getElementById('f-email').value.toLowerCase();
  const path    = document.getElementById('f-path').value.toLowerCase();
  const method  = document.getElementById('f-method').value;
  const status  = document.getElementById('f-status').value;
  const payload = document.getElementById('f-payload').value;
  const filtered = DATA.filter(r => {
    if (email   && !(r.email || '').toLowerCase().includes(email)) return false;
    if (path    && !r.path.toLowerCase().includes(path))           return false;
    if (method  && r.method !== method)                            return false;
    if (status  && !String(r.status).startsWith(status))          return false;
    if (payload && !r.body)                                        return false;
    return true;
  });
  render(filtered);
}

function clearFilters() {
  ['f-email','f-path'].forEach(id => document.getElementById(id).value = '');
  ['f-method','f-status','f-payload'].forEach(id => document.getElementById(id).value = '');
  render(DATA);
}

render(DATA);
</script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

export default router;
