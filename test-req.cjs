const http = require('http');

const data = JSON.stringify({
  prompt: "Build a youtube style video platform",
  history: [],
  isCustomThemeMode: false,
  attachments: []
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/vibe-code',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
