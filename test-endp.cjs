const http = require('http');

async function run() {
  const req = http.request({
    method: 'POST',
    path: '/api/vibe-code',
    hostname: 'localhost',
    port: 3000,
    headers: { 'Content-Type': 'application/json' }
  }, res => {
    console.log(res.statusCode);
    res.on('data', d => console.log(d.toString()));
  });
  
  req.write(JSON.stringify({
    prompt: "FAIL", // A special prompt
    history: []
  }));
  req.end();
}
run();
