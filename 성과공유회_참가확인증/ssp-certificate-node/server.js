require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const express = require('express');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

if (!ADMIN_PASSWORD || !JWT_SECRET) {
  console.error(
    '[설정 오류] .env 파일에 ADMIN_PASSWORD 와 JWT_SECRET 값을 설정해주세요. (.env.example 참고)'
  );
  process.exit(1);
}

const EVENT_INFO = {
  eventName: '스마트사회적처방 성과공유회',
  eventDate: '2026년 9월 10일(목)',
  eventTime: '16:00~18:00',
  certDate: '2026년 9월 10일',
  issuer: '밥상공동체종합사회복지관',
};
const CERT_PREFIX = 'SSP';
const CERT_DATE_CODE = '20260910';

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'participants.json');
const COUNTER_FILE = path.join(DATA_DIR, 'counter.json');

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
  if (!fs.existsSync(COUNTER_FILE)) {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify({ seq: 0 }), 'utf-8');
  }
}
ensureDataFiles();

function readParticipants() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}
function writeParticipants(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
}
function nextSeq() {
  const counter = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf-8'));
  counter.seq += 1;
  fs.writeFileSync(COUNTER_FILE, JSON.stringify(counter), 'utf-8');
  return counter.seq;
}
function makeCertNo() {
  const seq = nextSeq();
  return `${CERT_PREFIX}-${CERT_DATE_CODE}-${String(seq).padStart(3, '0')}`;
}
function normalizePhone(v) {
  return (v || '').toString().replace(/[^0-9]/g, '');
}
function normalizeName(v) {
  return (v || '').toString().trim();
}

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// 참가자용: 성함/휴대폰번호로 참가확인증 조회
// ---------------------------------------------------------------------------
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: '요청이 많습니다. 잠시 후 다시 시도해주세요.',
  },
});

app.post('/api/verify', verifyLimiter, (req, res) => {
  const name = normalizeName(req.body.name);
  const phone = normalizePhone(req.body.phone);

  if (!name || !phone) {
    return res.json({
      success: false,
      message:
        '참가확인증 발급 대상자를 확인할 수 없습니다.\n성함과 휴대폰번호를 다시 확인해주세요.',
    });
  }

  const list = readParticipants();
  const found = list.find((p) => p.name === name && p.phone === phone);

  if (!found) {
    return res.json({
      success: false,
      message:
        '참가확인증 발급 대상자를 확인할 수 없습니다.\n성함과 휴대폰번호를 다시 확인해주세요.',
    });
  }

  // 최초 조회 시에만 발급번호를 생성하고, 이후에는 동일한 번호를 재사용한다.
  if (!found.issueNo) {
    found.issueNo = makeCertNo();
    found.issuedAt = new Date().toISOString();
    writeParticipants(list);
  }

  res.json({
    success: true,
    name: found.name,
    issueNo: found.issueNo,
    ...EVENT_INFO,
  });
});

// ---------------------------------------------------------------------------
// 관리자 인증
// ---------------------------------------------------------------------------
function signToken() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
}
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
  }
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: '인증이 만료되었습니다. 다시 로그인해주세요.' });
  }
}

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { password } = req.body || {};
  if (password && password === ADMIN_PASSWORD) {
    return res.json({ success: true, token: signToken() });
  }
  res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' });
});

// ---------------------------------------------------------------------------
// 관리자: 참가자 명단 관리
// ---------------------------------------------------------------------------
app.get('/api/admin/participants', requireAdmin, (req, res) => {
  const list = readParticipants().slice().reverse();
  res.json({ success: true, data: list });
});

app.post('/api/admin/participants', requireAdmin, (req, res) => {
  const name = normalizeName(req.body.name);
  const phone = normalizePhone(req.body.phone);

  if (!name || !phone) {
    return res
      .status(400)
      .json({ success: false, message: '성함과 휴대폰번호를 입력해주세요.' });
  }

  const list = readParticipants();
  if (list.some((p) => p.name === name && p.phone === phone)) {
    return res.status(409).json({ success: false, message: '이미 등록된 참가자입니다.' });
  }

  const entry = {
    id: crypto.randomUUID(),
    name,
    phone,
    issueNo: null,
    issuedAt: null,
    createdAt: new Date().toISOString(),
  };
  list.push(entry);
  writeParticipants(list);
  res.json({ success: true, data: entry });
});

app.post('/api/admin/participants/bulk', requireAdmin, (req, res) => {
  const text = (req.body.text || '').toString();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const list = readParticipants();
  let added = 0;
  let skipped = 0;

  lines.forEach((line) => {
    const parts = line.split(/[,\t]/).map((s) => s.trim());
    const name = normalizeName(parts[0]);
    const phone = normalizePhone(parts[1]);

    if (!name || !phone) {
      skipped += 1;
      return;
    }
    if (list.some((p) => p.name === name && p.phone === phone)) {
      skipped += 1;
      return;
    }
    list.push({
      id: crypto.randomUUID(),
      name,
      phone,
      issueNo: null,
      issuedAt: null,
      createdAt: new Date().toISOString(),
    });
    added += 1;
  });

  writeParticipants(list);
  res.json({ success: true, added, skipped });
});

app.delete('/api/admin/participants/:id', requireAdmin, (req, res) => {
  const list = readParticipants();
  const next = list.filter((p) => p.id !== req.params.id);
  if (next.length === list.length) {
    return res.status(404).json({ success: false, message: '대상을 찾을 수 없습니다.' });
  }
  writeParticipants(next);
  res.json({ success: true });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
  console.log(`관리자 페이지: http://localhost:${PORT}/admin`);
});
