// Index.html + 가짜 명단(테스트용) => 더블클릭으로 열리는 미리보기 파일 생성
// 실제 배포물이 아니라, 디자인 확인용입니다.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'ssp-certificate', 'Index.html');
const BG = path.join(__dirname, '..', 'ssp-certificate', 'Background.html');
const OUT = path.join(__dirname, '..', '참가확인증_미리보기.html');

// Background.html 에 들어있는 data:image/png;base64,... 값을 그대로 씁니다.
let backgroundUrl = '';
if (fs.existsSync(BG)) {
  backgroundUrl = fs.readFileSync(BG, 'utf8').replace(/\s/g, '');
}

const STUB = `
<script>
  // ===== 미리보기 전용 가짜 서버 =====
  // 실제 배포본에서는 Google Apps Script가 구글시트를 조회합니다.
  // 여기서는 아래 명단에 있는 사람만 발급되도록 흉내만 냅니다.
  var 테스트명단 = [
    { 성명: '홍길동', 소속: '밥상공동체종합사회복지관', 번호: '01012345678' },
    { 성명: '김영희', 소속: '강원특별자치도 사회서비스원 스마트돌봄지원단', 번호: '01098765432' }
  ];
  window.google = { script: { run: {
    _s: null,
    withSuccessHandler: function (fn) { this._s = fn; return this; },
    withFailureHandler: function () { return this; },
    issueCertificate: function (name, phone) {
      var self = this;
      var n = String(name).replace(/\\s+/g, '');
      var p = String(phone).replace(/[^0-9]/g, '');
      var hit = 테스트명단.filter(function (x) { return x.성명 === n && x.번호 === p; })[0];
      setTimeout(function () {
        if (hit) {
          self._s({
            success: true,
            name: hit.성명,
            org: hit.소속,
            certNo: 'SSP-20260910-001'
          });
        } else {
          self._s({
            success: false,
            message: '입력하신 정보를 확인할 수 없습니다. 성명과 휴대폰번호를 다시 확인해 주세요.'
          });
        }
      }, 150);
    }
  } } };
</script>
<div style="max-width:520px;margin:20px auto 0;padding:12px 14px;background:#fffbe6;
            border:1px solid #f0d98c;border-radius:8px;font-size:13px;line-height:1.7;
            font-family:'Malgun Gothic',sans-serif;color:#6b5400;">
  <b>디자인 미리보기용 파일입니다.</b><br>
  아래 테스트 계정으로 확인증을 확인해 보세요.<br>
  · 홍길동 / 010-1234-5678 (짧은 소속)<br>
  · 김영희 / 010-9876-5432 (아주 긴 소속 - 자동 축소 확인용)
</div>
`;

const html = fs.readFileSync(SRC, 'utf8')
  // Apps Script 템플릿 자리를 실제 값으로 치환
  .replace('<?= backgroundUrl ?>', backgroundUrl)
  .replace('<?= backgroundDiag ?>', backgroundUrl ? ('OK / 길이 ' + backgroundUrl.length + '자') : '미리보기: 배경 없음')
  .replace('</head>', STUB.split('<div style=')[0] + '</head>')
  .replace('<main>', '<main>' + '<div style=' + STUB.split('<div style=')[1]);

fs.writeFileSync(OUT, html, 'utf8');
console.log('생성 완료:', OUT, '(배경 ' + (backgroundUrl ? '포함' : '없음') + ')');
