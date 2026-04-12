const API_BASE = "http://localhost:3000";

const el = (id) => document.getElementById(id);

let loadedQuestions = [];

function adminHeaders() {
  return {
    "Content-Type": "application/json",
    "x-admin-password": el("adminPassword").value.trim()
  };
}

function message(text, ok = true) {
  el("adminMessage").innerHTML = `<div class="message-box ${ok ? "" : "error"}">${escapeHtml(text)}</div>`;
}

function normalizeQuestion(q) {
  return {
    id: q.id || "",
    topic: q.topic || "",
    difficulty: q.difficulty || "medium",
    caseScenario: q.caseScenario ?? q.case_scenario ?? "",
    question: q.question || "",
    options: Array.isArray(q.options) ? q.options : [],
    correctAnswer: q.correctAnswer ?? q.correct_answer ?? "",
    explanation: q.explanation || "",
    summary: q.summary || ""
  };
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clearForm() {
  el("questionId").value = "";
  el("topic").value = "";
  el("difficulty").value = "medium";
  el("caseScenario").value = "";
  el("question").value = "";
  el("opt1").value = "";
  el("opt2").value = "";
  el("opt3").value = "";
  el("opt4").value = "";
  el("correctAnswer").value = "";
  el("explanation").value = "";
  el("summary").value = "";
}

function formData() {
  return {
    topic: el("topic").value.trim(),
    difficulty: el("difficulty").value,
    type: "case",
    caseScenario: el("caseScenario").value.trim(),
    question: el("question").value.trim(),
    options: [
      el("opt1").value.trim(),
      el("opt2").value.trim(),
      el("opt3").value.trim(),
      el("opt4").value.trim()
    ].filter(Boolean),
    correctAnswer: el("correctAnswer").value.trim(),
    explanation: el("explanation").value.trim(),
    summary: el("summary").value.trim()
  };
}

function renderQuestionList() {
  const list = el("questionList");
  list.innerHTML = "";

  loadedQuestions.forEach((question, index) => {
    const q = normalizeQuestion(question);
    const card = document.createElement("div");
    card.className = "review-card";

    card.innerHTML = `
      <h3>${escapeHtml(q.question)}</h3>
      <p><strong>Topic:</strong> ${escapeHtml(q.topic)}</p>
      <p><strong>Difficulty:</strong> ${escapeHtml(q.difficulty)}</p>
      <div class="small-row">
        <button class="mini-btn" type="button" data-action="edit" data-index="${index}">Edit</button>
        <button class="mini-btn" type="button" data-action="delete" data-id="${escapeHtml(q.id)}">Delete</button>
      </div>
    `;

    list.appendChild(card);
  });
}

async function loadQuestions() {
  try {
    const topic = el("filterTopic").value.trim();
    const url = topic
      ? `${API_BASE}/admin/questions?topic=${encodeURIComponent(topic)}`
      : `${API_BASE}/admin/questions`;

    const res = await fetch(url, {
      headers: { "x-admin-password": el("adminPassword").value.trim() }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load");

    loadedQuestions = Array.isArray(data.questions) ? data.questions : [];
    renderQuestionList();
  } catch (e) {
    message(e.message, false);
  }
}

window.editQuestion = function (q) {
  const normalized = normalizeQuestion(q);

  el("questionId").value = normalized.id;
  el("topic").value = normalized.topic;
  el("difficulty").value = normalized.difficulty;
  el("caseScenario").value = normalized.caseScenario;
  el("question").value = normalized.question;
  el("opt1").value = normalized.options?.[0] || "";
  el("opt2").value = normalized.options?.[1] || "";
  el("opt3").value = normalized.options?.[2] || "";
  el("opt4").value = normalized.options?.[3] || "";
  el("correctAnswer").value = normalized.correctAnswer;
  el("explanation").value = normalized.explanation;
  el("summary").value = normalized.summary;
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.deleteQuestion = async function (id) {
  if (!confirm("Delete this question?")) return;

  try {
    const res = await fetch(`${API_BASE}/admin/questions/${id}`, {
      method: "DELETE",
      headers: { "x-admin-password": el("adminPassword").value.trim() }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Delete failed");

    message("Question deleted.");
    loadQuestions();
  } catch (e) {
    message(e.message, false);
  }
};

async function saveQuestion() {
  try {
    const id = el("questionId").value.trim();
    const payload = formData();

    const url = id
      ? `${API_BASE}/admin/questions/${id}`
      : `${API_BASE}/admin/questions`;

    const method = id ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: adminHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");

    message(id ? "Question updated." : "Question added.");
    clearForm();
    loadQuestions();
  } catch (e) {
    message(e.message, false);
  }
}

el("questionList").addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;

  if (action === "edit") {
    const index = Number(target.dataset.index);
    const q = loadedQuestions[index];
    if (q) window.editQuestion(q);
  }

  if (action === "delete") {
    const id = target.dataset.id;
    if (id) window.deleteQuestion(id);
  }
});

el("saveBtn").addEventListener("click", saveQuestion);
el("clearBtn").addEventListener("click", clearForm);
el("loadBtn").addEventListener("click", loadQuestions);
