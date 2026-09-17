(function () {
  const screenLookup = document.getElementById('screen-lookup');
  const screenCert = document.getElementById('screen-certificate');
  const form = document.getElementById('lookup-form');
  const nameInput = document.getElementById('input-name');
  const phoneInput = document.getElementById('input-phone');
  const errorBox = document.getElementById('error-box');
  const submitBtn = document.getElementById('lookup-submit');

  const certCaptureArea = document.getElementById('cert-capture-area');
  const btnPdf = document.getElementById('btn-pdf');
  const btnPrint = document.getElementById('btn-print');
  const btnAgain = document.getElementById('btn-again');

  function showScreen(screen) {
    [screenLookup, screenCert].forEach((s) => s.classList.remove('active'));
    screen.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add('show');
  }

  function clearError() {
    errorBox.textContent = '';
    errorBox.classList.remove('show');
  }

  function fillCertificate(data) {
    document.getElementById('cert-issueno').textContent = data.issueNo || '-';
    document.getElementById('cert-event-name').textContent = data.eventName;
    document.getElementById('cert-event-name-inline').textContent = data.eventName;
    document.getElementById('cert-event-eyebrow').textContent = data.eventName;
    document.getElementById('cert-event-datetime').textContent =
      `${data.eventDate} ${data.eventTime}`;
    document.getElementById('cert-issuer-info').textContent = data.issuer;
    document.getElementById('cert-issuer').textContent = data.issuer;
    document.getElementById('cert-name').textContent = data.name;
    document.getElementById('cert-date').textContent = data.certDate;
    document.getElementById('cert-date-inline').textContent = data.certDate;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();

    if (!name || !phone) {
      showError('성함과 휴대폰번호를 모두 입력해주세요.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>조회 중...';

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();

      if (data.success) {
        fillCertificate(data);
        showScreen(screenCert);
      } else {
        showError(
          data.message ||
            '참가확인증 발급 대상자를 확인할 수 없습니다.\n성함과 휴대폰번호를 다시 확인해주세요.'
        );
      }
    } catch (err) {
      showError('일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '참가확인증 조회';
    }
  });

  btnAgain.addEventListener('click', () => {
    form.reset();
    clearError();
    showScreen(screenLookup);
  });

  btnPrint.addEventListener('click', () => {
    window.print();
  });

  btnPdf.addEventListener('click', async () => {
    btnPdf.disabled = true;
    const originalText = btnPdf.textContent;
    btnPdf.innerHTML = '<span class="spinner"></span>생성 중...';
    try {
      const canvas = await html2canvas(certCaptureArea, {
        scale: 2,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/png');

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 30; // 좌우 여백 15mm씩
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const x = (pageWidth - imgWidth) / 2;
      const y = Math.max(20, (pageHeight - imgHeight) / 2);

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);

      const name = document.getElementById('cert-name').textContent || '참가자';
      pdf.save(`참가확인증_${name}.pdf`);
    } catch (err) {
      alert('PDF 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      btnPdf.disabled = false;
      btnPdf.textContent = originalText;
    }
  });
})();
