(function () {
  const TOKEN_KEY = 'ssp_admin_token';

  const loginScreen = document.getElementById('login-screen');
  const adminScreen = document.getElementById('admin-screen');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const passwordInput = document.getElementById('admin-password');
  const btnLogout = document.getElementById('btn-logout');

  const singleName = document.getElementById('single-name');
  const singlePhone = document.getElementById('single-phone');
  const btnAddSingle = document.getElementById('btn-add-single');
  const singleStatus = document.getElementById('single-status');

  const bulkText = document.getElementById('bulk-text');
  const btnAddBulk = document.getElementById('btn-add-bulk');
  const bulkStatus = document.getElementById('bulk-status');

  const listBody = document.getElementById('list-body');
  const countLabel = document.getElementById('count-label');
  const searchBox = document.getElementById('search-box');

  let allParticipants = [];

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }
  function setToken(t) {
    sessionStorage.setItem(TOKEN_KEY, t);
  }
  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  }

  function showScreen(screen) {
    [loginScreen, adminScreen].forEach((s) => s.classList.remove('active'));
    screen.classList.add('active');
  }

  async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = Object.assign({}, options.headers, {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
    const res = await fetch(url, Object.assign({}, options, { headers }));
    if (res.status === 401) {
      clearToken();
      showScreen(loginScreen);
      throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
    }
    return res.json();
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatPhone(phone) {
    if (phone.length === 11) return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
    if (phone.length === 10) return phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
    return phone;
  }

  function renderList() {
    const keyword = searchBox.value.trim();
    const filtered = keyword
      ? allParticipants.filter(
          (p) => p.name.includes(keyword) || p.phone.includes(keyword.replace(/[^0-9]/g, ''))
        )
      : allParticipants;

    countLabel.textContent = `전체 ${allParticipants.length}명 (표시 ${filtered.length}명)`;

    if (filtered.length === 0) {
      listBody.innerHTML = '<tr class="empty-row"><td colspan="6">등록된 참가자가 없습니다.</td></tr>';
      return;
    }

    listBody.innerHTML = filtered
      .map((p) => {
        const issued = !!p.issueNo;
        return `
          <tr data-id="${p.id}">
            <td>${escapeHtml(p.name)}</td>
            <td>${formatPhone(p.phone)}</td>
            <td><span class="badge ${issued ? 'issued' : 'pending'}">${issued ? '발급완료' : '미발급'}</span></td>
            <td>${issued ? p.issueNo : '-'}</td>
            <td>${formatDate(p.createdAt)}</td>
            <td><button class="del-btn" data-id="${p.id}">삭제</button></td>
          </tr>`;
      })
      .join('');
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c]));
  }

  async function loadList() {
    const data = await apiFetch('/api/admin/participants');
    if (data.success) {
      allParticipants = data.data;
      renderList();
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.remove('show');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.value }),
      });
      const data = await res.json();
      if (data.success) {
        setToken(data.token);
        passwordInput.value = '';
        showScreen(adminScreen);
        loadList();
      } else {
        loginError.textContent = data.message || '로그인에 실패했습니다.';
        loginError.classList.add('show');
      }
    } catch (err) {
      loginError.textContent = '서버에 연결할 수 없습니다.';
      loginError.classList.add('show');
    }
  });

  btnLogout.addEventListener('click', () => {
    clearToken();
    showScreen(loginScreen);
  });

  btnAddSingle.addEventListener('click', async () => {
    singleStatus.className = 'status-msg';
    singleStatus.textContent = '';
    const name = singleName.value.trim();
    const phone = singlePhone.value.trim();
    if (!name || !phone) {
      singleStatus.textContent = '성함과 휴대폰번호를 입력해주세요.';
      singleStatus.classList.add('err');
      return;
    }
    try {
      const data = await apiFetch('/api/admin/participants', {
        method: 'POST',
        body: JSON.stringify({ name, phone }),
      });
      if (data.success) {
        singleStatus.textContent = '등록되었습니다.';
        singleStatus.classList.add('ok');
        singleName.value = '';
        singlePhone.value = '';
        loadList();
      } else {
        singleStatus.textContent = data.message || '등록에 실패했습니다.';
        singleStatus.classList.add('err');
      }
    } catch (err) {
      singleStatus.textContent = err.message || '오류가 발생했습니다.';
      singleStatus.classList.add('err');
    }
  });

  btnAddBulk.addEventListener('click', async () => {
    bulkStatus.className = 'status-msg';
    const text = bulkText.value.trim();
    if (!text) {
      bulkStatus.textContent = '등록할 명단을 입력해주세요.';
      bulkStatus.classList.add('err');
      return;
    }
    try {
      const data = await apiFetch('/api/admin/participants/bulk', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      if (data.success) {
        bulkStatus.textContent = `${data.added}명 등록 완료, ${data.skipped}건 건너뜀(중복/형식오류).`;
        bulkStatus.classList.add('ok');
        bulkText.value = '';
        loadList();
      } else {
        bulkStatus.textContent = data.message || '일괄 등록에 실패했습니다.';
        bulkStatus.classList.add('err');
      }
    } catch (err) {
      bulkStatus.textContent = err.message || '오류가 발생했습니다.';
      bulkStatus.classList.add('err');
    }
  });

  listBody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.del-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    if (!confirm('이 참가자를 삭제하시겠습니까?')) return;
    try {
      const data = await apiFetch(`/api/admin/participants/${id}`, { method: 'DELETE' });
      if (data.success) loadList();
    } catch (err) {
      alert(err.message || '삭제에 실패했습니다.');
    }
  });

  searchBox.addEventListener('input', renderList);

  // 초기 진입: 토큰이 있으면 바로 목록 로드 시도
  if (getToken()) {
    showScreen(adminScreen);
    loadList().catch(() => showScreen(loginScreen));
  }
})();
