const API_BASE = "http://localhost:3000";

const el = (id) => document.getElementById(id);

function adminHeaders() {
  return {
    "Content-Type": "application/json",
    "x-admin-password": el("adminPassword").value.trim()
  };
}

function message(text, ok = true) {
  el("adminMessage").innerHTML = `<p class="muted" style="color:${ok ? "#1c9d61" : "#d84d4d"};">${text}</p>`;
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

    el("questionList").innerHTML = data.questions.map(q => `
      <div class="review-card">
        <h3>${q.question}</h3>
        <p><strong>Topic:</strong> ${q.topic}</p>
        <p><strong>Difficulty:</strong> ${q.difficulty}</p>
        <div class="small-row">
          <button class="mini-btn" onclick='editQuestion(${JSON.stringify(q).replace(/'/g, "&apos;")})'>Edit</button>
          <button class="mini-btn" onclick="deleteQuestion('${q.id}')">Delete</button>
        </div>
      </div>
    `).join("");
  } catch (e) {
    message(e.message, false);
  }
}

window.editQuestion = function (q) {
  el("questionId").value = q.id || "";
  el("topic").value = q.topic || "";
  el("difficulty").value = q.difficulty || "medium";
  el("caseScenario").value = q.caseScenario || "";
  el("question").value = q.question || "";
  el("opt1").value = q.options?.[0] || "";
  el("opt2").value = q.options?.[1] || "";
  el("opt3").value = q.options?.[2] || "";
  el("opt4").value = q.options?.[3] || "";
  el("correctAnswer").value = q.correctAnswer || "";
  el("explanation").value = q.explanation || "";
  el("summary").value = q.summary || "";
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

el("saveBtn").addEventListener("click", saveQuestion);
el("clearBtn").addEventListener("click", clearForm);
el("loadBtn").addEventListener("click", loadQuestions);