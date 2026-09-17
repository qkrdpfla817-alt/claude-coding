import { supabase, TABLE_NAME } from "./supabaseClient.js";

const form = document.getElementById("apply-form");
const statusEl = document.getElementById("status");
const listBody = document.getElementById("list-body");

function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type ?? "";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR");
}

async function loadApplications() {
  const { data, error } = await supabase.from(TABLE_NAME).select("*");

  if (error) {
    setStatus(`목록을 불러오지 못했습니다: ${error.message}`, "error");
    return;
  }

  listBody.innerHTML = "";
  for (const row of [...data].reverse()) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row["이름"] ?? ""}</td>
      <td>${row["연락처"] ?? ""}</td>
      <td>${row["신청프로그램"] ?? ""}</td>
      <td>${formatDate(row["신청일시"])}</td>
    `;
    listBody.appendChild(tr);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector("button[type=submit]");
  submitButton.disabled = true;
  setStatus("", "");

  const formData = new FormData(form);
  const payload = {
    "이름": formData.get("name").trim(),
    "연락처": formData.get("contact").trim(),
    "신청프로그램": formData.get("program").trim(),
  };

  const { error } = await supabase.from(TABLE_NAME).insert(payload);

  submitButton.disabled = false;

  if (error) {
    setStatus(`신청 실패: ${error.message}`, "error");
    return;
  }

  setStatus("신청이 완료되었습니다.", "success");
  form.reset();
  await loadApplications();
});

loadApplications();
