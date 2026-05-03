const http = require('http');

const data = JSON.stringify({
  prompt: "Fix the error",
  history: [{ role: 'model', text: '' }, { role: 'user', text: 'build a game like agar.io' }, { role: 'model', text: 'ok' }],
  isCustomThemeMode: false
});

const req = http.request('http://localhost:3000/api/vibe-code', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log(`BODY LENGTH: ${body.length}`);
    const last100 = body.slice(-100);
    console.log(`LAST 100:\n${last100}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
