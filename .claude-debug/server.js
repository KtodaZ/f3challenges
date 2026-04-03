const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
const LOG_FILE = path.join(__dirname, 'debug.log');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const timestamp = new Date().toISOString();
      const entry = `[${timestamp}] ${body}\n`;
      fs.appendFileSync(LOG_FILE, entry);
      console.log(entry.trim());
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'logged' }));
    });
  } else {
    res.writeHead(405);
    res.end('Method not allowed');
  }
});

server.listen(PORT, () => {
  console.log(`Debug server listening on http://localhost:${PORT}`);
  console.log(`Logging to ${LOG_FILE}`);
});
