/**
 * ============================================================================
 *  스마트사회적처방 성과공유회 - 참가확인증 발급 (서버 코드)
 * ============================================================================
 *  Google Apps Script 서버 코드(.gs)입니다.
 *
 *  확인증의 디자인(제목·본문·날짜·기관명·직인·테두리)은 전부 배경 PNG 이미지
 *  안에 들어 있고, 웹에서는 그 위에 [소속] [성명] [발급번호]만 얹어서 보여줍니다.
 *
 *  Apps Script 프로젝트에 필요한 파일은 3개입니다.
 *    1) Code.gs      - 이 파일
 *    2) Index        - 화면 (HTML)
 *    3) Background   - 배경 PNG를 글자로 바꾼 값 (HTML 파일로 만들어 붙여넣기)
 *
 *  설치·배포 방법은 README.md를 참고하세요.
 * ============================================================================
 */


/* ============================================================================
 *  ① 설정 (필수 확인 / 수정)
 * ==========================================================================*/

// [1] 참석자 명단이 들어있는 "시트 탭 이름"
const LIST_SHEET_NAME = '참석자명단';

// [2] 명단 시트 1행(헤더)의 열 이름
//     - 시트 1행에 적힌 문구와 정확히 같아야 합니다.
//     - 소속은 없어도 동작합니다. (그 경우 확인증에 소속이 비어서 나옵니다)
const COLUMN_NAME_HEADER = '성명';
const COLUMN_ORG_HEADER = '소속';
const COLUMN_PHONE_HEADER = '휴대폰번호';

// [3] 발급 기록용 컬럼 헤더 이름 (시트에 없으면 자동으로 맨 뒤에 추가됩니다)
const COLUMN_ISSUED_HEADER = '발급여부';
const COLUMN_CERT_NO_HEADER = '발급번호';
const COLUMN_ISSUED_AT_HEADER = '최초 발급일시';
const COLUMN_ISSUE_COUNT_HEADER = '발급횟수';

// [4] 행사 이름 (웹페이지 제목에만 사용됩니다. 확인증 문구는 배경 PNG 안에 있습니다.)
const EVENT_NAME = '스마트사회적처방 성과공유회';

// [5] 발급번호 형식 (예: SSP-20260910-001)
const CERT_PREFIX = 'SSP';
const CERT_DATE_STR = '20260910';

// [6] 배경 PNG 등록 방법 (아래 둘 중 하나만 하시면 됩니다)
//
//   [방법 A · 추천] 구글 드라이브에 PNG를 올리고 그 파일 ID를 여기에 적기
//      1) 드라이브에 확인증 PNG 업로드
//      2) 파일 더블클릭 → 주소창 확인
//         https://drive.google.com/file/d/  ←여기부터 다음 /까지가 파일 ID→  /view
//      3) 그 ID를 아래 따옴표 안에 붙여넣기
//      ※ 공유 설정은 바꾸지 않아도 됩니다. 서버(예림님 계정)가 직접 읽어옵니다.
const BACKGROUND_DRIVE_FILE_ID = '1BmkAMYs1Qn684oCEKXOOXv49FlzWVvms';
//
//   [방법 B] Apps Script에 Background 라는 HTML 파일을 만들고
//            'data:image/png;base64,...' 글자열을 통째로 붙여넣기
//            (글자 수가 매우 길어 붙여넣기가 오래 걸립니다)
const BACKGROUND_FILE_NAME = 'Background';

// [7] 시간대 (발급일시 기록용). 한국이면 그대로 두세요.
const DISPLAY_TIMEZONE = 'Asia/Seoul';


/* ==========================================================================
 *  ② 스프레드시트 상단 메뉴 추가
 *     코드를 저장한 뒤 스프레드시트를 새로고침(F5)하면 "참가확인증" 메뉴가 생깁니다.
 *     이 메뉴가 보이지 않으면 스크립트가 이 시트에 연결되지 않은 것입니다.
 *     (반드시 시트에서 [확장 프로그램] > [Apps Script]로 열어야 연결됩니다)
 * ==========================================================================*/

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('참가확인증')
    .addItem('① 명단 시트 준비하기', 'setupSheet')
    .addItem('② 배경 이미지 점검하기', 'checkBackgroundImage')
    .addToUi();
}


/* ==========================================================================
 *  ②-1 배경 이미지 점검 (문제가 생겼을 때 원인을 알려줍니다)
 *
 *      "배경 이미지가 아직 등록되지 않았습니다" 가 뜰 때 실행해 보세요.
 *      스프레드시트 [참가확인증] > [② 배경 이미지 점검하기] 로 실행합니다.
 *
 *      ※ 이 기능을 처음 실행하면 "구글 드라이브 접근 권한" 승인 창이 뜹니다.
 *         반드시 허용해 주세요. 이 승인을 안 하면 배경 이미지를 읽지 못합니다.
 * ==========================================================================*/

function checkBackgroundImage() {
  let report = '';

  // --- 방법 A : 드라이브 파일 ID 점검 ---
  if (!BACKGROUND_DRIVE_FILE_ID) {
    report += '[방법 A] 드라이브 파일 ID : 비어 있음\n';
    report += '   → Code.gs 의 BACKGROUND_DRIVE_FILE_ID 에 파일 ID를 넣어주세요.\n\n';
  } else {
    report += '[방법 A] 드라이브 파일 ID : ' + BACKGROUND_DRIVE_FILE_ID + '\n';

    if (BACKGROUND_DRIVE_FILE_ID.indexOf('http') === 0 ||
        BACKGROUND_DRIVE_FILE_ID.indexOf('/') > -1) {
      report += '   ❌ 주소(URL) 전체를 넣으셨습니다.\n';
      report += '      https://drive.google.com/file/d/[여기]/view\n';
      report += '      대괄호 부분만 넣어주세요.\n\n';
    } else {
      try {
        const file = DriveApp.getFileById(BACKGROUND_DRIVE_FILE_ID);
        const blob = file.getBlob();
        const type = blob.getContentType();
        const kb = Math.round(blob.getBytes().length / 1024);

        report += '   ✅ 파일을 찾았습니다.\n';
        report += '      이름 : ' + file.getName() + '\n';
        report += '      형식 : ' + type + '\n';
        report += '      크기 : ' + kb + ' KB\n';

        if (String(type).indexOf('image') !== 0) {
          report += '   ❌ 이미지 파일이 아닙니다. PNG 파일의 ID인지 확인해 주세요.\n';
        } else {
          report += '   ✅ 배경 이미지 사용 준비 완료!\n';
        }
        report += '\n';
      } catch (err) {
        report += '   ❌ 파일을 읽지 못했습니다.\n';
        report += '      사유 : ' + err.message + '\n';
        report += '      · 파일 ID가 정확한지\n';
        report += '      · 그 파일이 내 드라이브에 있는지\n';
        report += '      확인해 주세요.\n\n';
      }
    }
  }

  // --- 방법 B : Background HTML 파일 점검 ---
  try {
    const raw = HtmlService.createHtmlOutputFromFile(BACKGROUND_FILE_NAME).getContent();
    const trimmed = (raw || '').replace(/\s/g, '');
    if (trimmed.indexOf('data:image') === 0) {
      report += '[방법 B] Background 파일 : ✅ 정상 (' +
                Math.round(trimmed.length / 1024) + ' KB)\n\n';
    } else {
      report += '[방법 B] Background 파일 : ❌ 내용이 data:image 로 시작하지 않습니다.\n\n';
    }
  } catch (err) {
    report += '[방법 B] Background 파일 : 없음 (방법 A를 쓰신다면 정상입니다)\n\n';
  }

  // --- 최종 결과 ---
  const url = getBackgroundDataUrl_();
  report += '────────────────────────\n';
  if (url) {
    report += '최종 결과 : ✅ 배경 이미지 준비 완료\n\n';
    report += '그래도 웹앱에 안 나온다면 재배포를 안 하신 것입니다.\n';
    report += '[배포] > [배포 관리] > 연필(✏) > 버전을 "새 버전"으로 > [배포]';
  } else {
    report += '최종 결과 : ❌ 배경 이미지를 읽지 못했습니다.\n\n';
    report += '위의 ❌ 표시된 항목을 확인해 주세요.';
  }

  SpreadsheetApp.getUi().alert('배경 이미지 점검 결과', report,
    SpreadsheetApp.getUi().ButtonSet.OK);
}


/* ==========================================================================
 *  ③ 웹앱 진입점 - "웹 앱으로 배포"하면 이 함수가 실행됩니다.
 *     배경 이미지는 페이지를 열 때 한 번만 내려보냅니다.
 * ==========================================================================*/

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');

  // 배경 이미지를 읽어오면서, 잘 안 될 경우를 대비해 진단 정보도 같이 담습니다.
  let backgroundUrl = '';
  let diag = '';
  try {
    backgroundUrl = getBackgroundDataUrl_();
    if (backgroundUrl) {
      diag = 'OK / 길이 ' + backgroundUrl.length + '자';
    } else if (!BACKGROUND_DRIVE_FILE_ID) {
      diag = '파일 ID가 비어 있음 (Code.gs 설정 [6] 확인)';
    } else {
      diag = '파일 ID는 있으나 읽지 못함 (드라이브 권한/ID 확인)';
    }
  } catch (err) {
    diag = '오류: ' + err.message;
  }

  template.backgroundUrl = backgroundUrl;
  template.backgroundDiag = diag;

  return template.evaluate()
    .setTitle(EVENT_NAME + ' 참가확인증 발급')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 배경 PNG를 'data:image/png;base64,...' 형태로 만들어 돌려줍니다.
 *
 * 왜 이렇게 하나요?
 *   PDF 저장 기능(html2canvas)은 "다른 사이트 주소로 불러온 이미지"가 섞여 있으면
 *   보안상 저장을 거부합니다. 그래서 이미지를 주소가 아니라 "글자"로 바꿔서
 *   페이지 안에 직접 심어 넣습니다.
 *
 * 한 번 읽어온 값은 6시간 동안 캐시에 저장해 두어 페이지가 빨리 열리게 합니다.
 */
function getBackgroundDataUrl_() {
  // [방법 A] 드라이브 파일 ID가 적혀 있으면 그쪽을 먼저 사용합니다.
  if (BACKGROUND_DRIVE_FILE_ID) {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'bg_' + BACKGROUND_DRIVE_FILE_ID;

    // 캐시는 한 칸에 100KB까지만 담기므로 여러 조각으로 나눠 저장합니다.
    try {
      const meta = cache.get(cacheKey + '_n');
      if (meta) {
        const keys = [];
        for (let i = 0; i < Number(meta); i++) keys.push(cacheKey + '_' + i);
        const parts = cache.getAll(keys);
        let joined = '';
        let ok = true;
        for (let i = 0; i < Number(meta); i++) {
          const piece = parts[cacheKey + '_' + i];
          if (piece == null) { ok = false; break; }
          joined += piece;
        }
        if (ok && joined) return joined;
      }
    } catch (err) { /* 캐시 실패는 무시하고 그냥 다시 읽습니다 */ }

    try {
      const blob = DriveApp.getFileById(BACKGROUND_DRIVE_FILE_ID).getBlob();
      const mime = blob.getContentType() || 'image/png';
      const dataUrl = 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes());

      try {
        const CHUNK = 90000;
        const store = {};
        let n = 0;
        for (let p = 0; p < dataUrl.length; p += CHUNK) {
          store[cacheKey + '_' + n] = dataUrl.substring(p, p + CHUNK);
          n++;
        }
        store[cacheKey + '_n'] = String(n);
        cache.putAll(store, 21600); // 6시간
      } catch (err) { /* 캐시 저장 실패는 무시 */ }

      return dataUrl;
    } catch (err) {
      // 파일 ID가 틀렸거나 권한이 없는 경우 → 방법 B로 넘어갑니다.
    }
  }

  // [방법 B] Background HTML 파일에 붙여넣은 base64 글자열을 읽어옵니다.
  try {
    const raw = HtmlService.createHtmlOutputFromFile(BACKGROUND_FILE_NAME).getContent();
    const trimmed = (raw || '').replace(/\s/g, '');
    return trimmed.indexOf('data:image') === 0 ? trimmed : '';
  } catch (err) {
    // Background 파일이 아직 없으면 빈 값을 돌려주고, 화면에서 안내 메시지를 띄웁니다.
    return '';
  }
}


/* ==========================================================================
 *  ④ 참가확인증 조회/발급 (클라이언트에서 google.script.run 으로 호출)
 *     명단 대조는 전부 서버 측에서 처리되며, 브라우저에는 조회에 성공한
 *     본인의 [성명 / 소속 / 발급번호]만 반환됩니다.
 *     (전체 명단은 절대 프론트엔드로 전달되지 않습니다.)
 * ==========================================================================*/

function issueCertificate(inputName, inputPhone) {
  const NOT_FOUND_MESSAGE =
    '입력하신 정보를 확인할 수 없습니다. 성명과 휴대폰번호를 다시 확인해 주세요.';

  const result = { success: false, message: '' };

  const name = normalizeName_(inputName);
  const phone = normalizePhone_(inputPhone);

  if (!name) {
    result.message = '성명을 입력해 주세요.';
    return result;
  }
  if (phone.length < 9) {
    result.message = '휴대폰번호를 정확히 입력해 주세요.';
    return result;
  }

  // 여러 명이 동시에 조회해도 발급번호가 중복되지 않도록 잠금 처리
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30 * 1000);
  } catch (err) {
    result.message = '요청이 많아 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    return result;
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LIST_SHEET_NAME);
    if (!sheet) {
      result.message = '서버 설정 오류입니다. 관리자에게 문의해 주세요. (시트 이름 확인 필요)';
      return result;
    }

    const cols = ensureManagementColumns_(sheet);
    const data = sheet.getDataRange().getValues();
    const headers = data[0] || [];

    const nameCol = headers.indexOf(COLUMN_NAME_HEADER);
    const phoneCol = headers.indexOf(COLUMN_PHONE_HEADER);
    const orgCol = headers.indexOf(COLUMN_ORG_HEADER); // 없으면 -1 (소속 없이 동작)

    if (nameCol === -1 || phoneCol === -1) {
      result.message = '서버 설정 오류입니다. 관리자에게 문의해 주세요. (컬럼명 확인 필요)';
      return result;
    }

    let matchedRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (normalizeName_(data[i][nameCol]) === name &&
          normalizePhone_(data[i][phoneCol]) === phone) {
        matchedRowIndex = i;
        break;
      }
    }

    if (matchedRowIndex === -1) {
      result.message = NOT_FOUND_MESSAGE;
      return result;
    }

    const sheetRow = matchedRowIndex + 1;
    const matchedRow = data[matchedRowIndex];

    // 시트에 적힌 원본 성명을 사용 (입력값의 공백 차이에 영향받지 않도록)
    const displayName = (matchedRow[nameCol] || '').toString().trim();
    const displayOrg = orgCol === -1 ? '' : (matchedRow[orgCol] || '').toString().trim();

    let certNo = matchedRow[cols.certNoCol - 1];
    if (!certNo) {
      // 최초 발급: 발급번호 채번 후 기록
      certNo = generateNextCertNo_(sheet, cols.certNoCol);
      sheet.getRange(sheetRow, cols.issuedCol).setValue('발급');
      sheet.getRange(sheetRow, cols.certNoCol).setValue(certNo);
      sheet.getRange(sheetRow, cols.issuedAtCol)
        .setValue(Utilities.formatDate(new Date(), DISPLAY_TIMEZONE, 'yyyy-MM-dd HH:mm'));
    }

    // 재발급 제한은 없으며, 몇 번 발급했는지만 기록합니다.
    const prevCount = parseInt(matchedRow[cols.issueCountCol - 1], 10) || 0;
    sheet.getRange(sheetRow, cols.issueCountCol).setValue(prevCount + 1);

    result.success = true;
    result.name = displayName;
    result.org = displayOrg;
    result.certNo = certNo;
    return result;
  } catch (err) {
    result.message = '오류가 발생했습니다. 관리자에게 문의해 주세요. (' + err.message + ')';
    return result;
  } finally {
    lock.releaseLock();
  }
}


/* ==========================================================================
 *  ⑤ 내부 헬퍼 함수 (수정하지 않아도 됩니다)
 * ==========================================================================*/

// 소속 / 발급 기록용 컬럼이 없으면 맨 뒤에 자동으로 추가합니다.
// 이미 쓰던 명단 시트도 그대로 사용할 수 있게 하기 위한 처리입니다.
// (컬럼은 "순서"가 아니라 "이름"으로 찾으므로 위치가 달라도 괜찮습니다.)
function ensureManagementColumns_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  const required = [
    COLUMN_ORG_HEADER,
    COLUMN_ISSUED_HEADER,
    COLUMN_CERT_NO_HEADER,
    COLUMN_ISSUED_AT_HEADER,
    COLUMN_ISSUE_COUNT_HEADER
  ];

  const finalHeaders = headers.slice();
  let changed = false;
  required.forEach(function (h) {
    if (finalHeaders.indexOf(h) === -1) {
      finalHeaders.push(h);
      changed = true;
    }
  });
  if (changed) {
    sheet.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]);
  }

  return {
    orgCol: finalHeaders.indexOf(COLUMN_ORG_HEADER) + 1,
    issuedCol: finalHeaders.indexOf(COLUMN_ISSUED_HEADER) + 1,
    certNoCol: finalHeaders.indexOf(COLUMN_CERT_NO_HEADER) + 1,
    issuedAtCol: finalHeaders.indexOf(COLUMN_ISSUED_AT_HEADER) + 1,
    issueCountCol: finalHeaders.indexOf(COLUMN_ISSUE_COUNT_HEADER) + 1
  };
}

// 다음 발급번호 생성 (예: SSP-20260910-001)
// issueCertificate() 안에서 LockService로 보호된 상태로만 호출됩니다.
function generateNextCertNo_(sheet, certNoCol) {
  const lastRow = sheet.getLastRow();
  let count = 0;
  if (lastRow > 1) {
    const values = sheet.getRange(2, certNoCol, lastRow - 1, 1).getValues();
    for (let i = 0; i < values.length; i++) {
      if (values[i][0]) count++;
    }
  }
  return CERT_PREFIX + '-' + CERT_DATE_STR + '-' + ('000' + (count + 1)).slice(-3);
}

// 성명 정규화: 앞뒤 공백은 물론 이름 중간의 모든 공백도 제거해서 비교
function normalizeName_(value) {
  return (value || '').toString().replace(/\s+/g, '');
}

// 휴대폰번호 정규화: 숫자가 아닌 문자를 모두 제거
// "010-1234-5678"과 "01012345678"을 같은 값으로 취급합니다.
function normalizePhone_(value) {
  return (value || '').toString().replace(/[^0-9]/g, '');
}


/* ==========================================================================
 *  ⑥ 명단 시트 만들기
 *     스프레드시트 상단 [참가확인증] > [① 명단 시트 준비하기] 로 실행합니다.
 *
 *     새로 만들 때 헤더 순서:
 *       성명 | 소속 | 휴대폰번호 | 발급여부 | 발급번호 | 최초 발급일시 | 발급횟수
 *
 *     이미 쓰던 시트가 있으면 기존 데이터는 그대로 두고,
 *     빠져 있는 컬럼(소속 등)만 맨 뒤에 덧붙입니다.
 * ==========================================================================*/

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      '이 스크립트가 스프레드시트에 연결되어 있지 않습니다.\n' +
      '구글시트를 열고 [확장 프로그램] > [Apps Script] 메뉴로 다시 만들어 주세요.'
    );
  }

  let sheet = ss.getSheetByName(LIST_SHEET_NAME);
  let isNew = false;
  if (!sheet) {
    sheet = ss.insertSheet(LIST_SHEET_NAME);
    isNew = true;
  }

  // 완전히 비어 있는 시트일 때만 이상적인 헤더 순서로 만들어 줍니다.
  if (isNew || !sheet.getRange(1, 1).getValue()) {
    const headers = [
      COLUMN_NAME_HEADER,
      COLUMN_ORG_HEADER,
      COLUMN_PHONE_HEADER,
      COLUMN_ISSUED_HEADER,
      COLUMN_CERT_NO_HEADER,
      COLUMN_ISSUED_AT_HEADER,
      COLUMN_ISSUE_COUNT_HEADER
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 110);  // 성명
    sheet.setColumnWidth(2, 200);  // 소속
    sheet.setColumnWidth(3, 140);  // 휴대폰번호
  }

  // 휴대폰번호 열의 앞자리 0이 사라지지 않도록 텍스트 서식으로 지정
  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const phoneColIndex = currentHeaders.indexOf(COLUMN_PHONE_HEADER) + 1;
  if (phoneColIndex > 0) {
    sheet.getRange(1, phoneColIndex, sheet.getMaxRows(), 1).setNumberFormat('@');
  }

  // 기존 시트에 소속 등 빠진 컬럼이 있으면 추가
  ensureManagementColumns_(sheet);
  sheet.activate();

  const msg = '"' + LIST_SHEET_NAME + '" 시트 준비가 완료되었습니다.\n\n' +
              '헤더: 성명 | 소속 | 휴대폰번호 | 발급여부 | 발급번호 | 최초 발급일시 | 발급횟수\n' +
              '2행부터 성명·소속·휴대폰번호를 붙여넣으세요.\n' +
              '(발급여부 뒤쪽 칸은 비워두시면 자동으로 채워집니다)';

  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
}
