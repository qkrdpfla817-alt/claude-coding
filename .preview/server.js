// 미리보기 전용 임시 서버 (배포물 아님)
// .preview/build-preview.js 가 만든 참가확인증_미리보기.html 을 그대로 띄웁니다.
const http = require('http');
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '참가확인증_미리보기.html');

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(FILE, 'utf8'));
}).listen(4321, () => console.log('preview on http://localhost:4321'));
