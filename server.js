const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = new Set(['index.html', 'app.js', 'style.css', 'modal.js', 'modal.css']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.flac': 'audio/flac', '.lrc': 'text/plain; charset=utf-8' };
const clients = new Set();
const versions = () => Object.fromEntries([...files].map(name => {
  try { const stat = fs.statSync(path.join(__dirname, name)); return [name, `${stat.mtimeMs}:${stat.size}`]; }
  catch { return [name, 'missing']; }
}));
function broadcast() {
  const message = `data: ${JSON.stringify(versions())}\n\n`;
  for (const client of clients) client.write(message);
}
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
  let name;
  try { name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1) || 'index.html'; }
  catch { res.writeHead(400); res.end(); return; }
  if (name === '__preview/events') {
    if (req.method === 'HEAD') { res.writeHead(200); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
    clients.add(res);
    res.write(`data: ${JSON.stringify(versions())}\n\n`);
    const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 15000);
    res.on('close', () => { clearInterval(heartbeat); clients.delete(res); });
    return;
  }
  if (name === '__preview/client.js') {
    res.writeHead(200, { 'Content-Type': types['.js'], 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(path.join(__dirname, 'preview-reload.js')));
    return;
  }
  if (name === 'index.html') {
    fs.readFile(path.join(__dirname, name), 'utf8', (error, html) => {
      if (error) { res.writeHead(404); res.end(); return; }
      const body = html.replace('</body>', '<script src="/__preview/client.js"></script></body>');
      res.writeHead(200, { 'Content-Type': types['.html'], 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
      res.end(req.method === 'HEAD' ? undefined : body);
    });
    return;
  }
  const isAudio = /^audio\/(tracks|lyrics)\/[\w -]+\.(mp3|m4a|ogg|wav|flac|lrc)$/i.test(name);
  if (!files.has(name) && !isAudio) { res.writeHead(404); res.end(); return; }
  const filename = path.join(__dirname, name);
  fs.stat(filename, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404); res.end(); return; }
    const headers = { 'Content-Type': types[path.extname(name).toLowerCase()], 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    let start = 0, end = stat.size - 1, status = 200;
    if (req.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
      if (match && (match[1] || match[2])) {
        start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
        end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
      } else start = NaN;
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size }); res.end(); return;
      }
      status = 206;
      headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + stat.size;
    }
    headers['Content-Length'] = Math.max(0, end - start + 1);
    res.writeHead(status, headers);
    if (req.method === 'HEAD' || stat.size === 0) { res.end(); return; }
    const stream = fs.createReadStream(filename, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
});
server.on('listening', () => {
  for (const name of files) fs.watchFile(path.join(__dirname, name), { interval: 300 }, broadcast);
});
server.on('close', () => {
  for (const name of files) fs.unwatchFile(path.join(__dirname, name), broadcast);
});
if (require.main === module || require.main?.filename.endsWith('serve.cjs')) {
  server.listen(4173, '127.0.0.1', () => console.log('FIELD: http://127.0.0.1:4173'));
}
module.exports = server;
