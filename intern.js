import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://mflvykvoszvzrholoblp.supabase.co';
const supabaseAnonKey = 'sb_publishable_6UoVagkJGjFDqWcLVyJuFQ_J6f7jOef';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const state = {
  topics: [],
  questions: [],
  current: 0,
  mode: "practice",
  answers: {},
  bookmarks: {},
  timerId: null,
  remainingSeconds: 0,
  reviewRows: []
};

const el = (id) => document.getElementById(id);

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchTopics() {
  const { data, error } = await supabase
    .from('intern_questions')
    .select('topic')
    .eq('is_active', true);

  if (error) {
    console.error("fetchTopics error:", error);
    throw new Error("Failed to load topics.");
  }

  return [...new Set((data || []).map(item => String(item.topic).trim().toLowerCase()))];
}

async function fetchExam(payload) {
  const { topics = [], count = 10, difficulty = "all" } = payload;

  let query = supabase
    .from('intern_questions')
    .select('*')
    .eq('is_active', true);

  if (topics.length) {
    query = query.in('topic', topics);
  }

  if (difficulty !== 'all') {
    query = query.eq('difficulty', difficulty);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchExam error:", error);
    throw new Error("Failed to load questions.");
  }

  if (!data || !data.length) {
    throw new Error("No matching questions found.");
  }

  return shuffle(data)
    .slice(0, count)
    .map(q => ({
      id: q.id,
      topic: q.topic,
      difficulty: q.difficulty,
      type: q.type,
      caseScenario: q.case_scenario || "",
      question: q.question,
      options: shuffle(q.options || []),
      correctAnswer: q.correct_answer,
      explanation: q.explanation || "",
      summary: q.summary || ""
    }));
}

function renderTopics(list) {
  const wrap = el("topicsWrap");
  wrap.innerHTML = "";

  list.forEach(topic => {
    const item = document.createElement("div");
    item.className = "topic-item";
    item.innerHTML = `
      <label>
        <input type="checkbox" value="${escapeHtml(topic)}" checked />
        <span>${escapeHtml(topic)}</span>
      </label>
    `;
    wrap.appendChild(item);
  });
}

function getSelectedTopics() {
  return [...document.querySelectorAll('#topicsWrap input[type="checkbox"]:checked')]
    .map(i => i.value.trim().toLowerCase());
}

function filterTopicsUI(term) {
  const q = term.trim().toLowerCase();
  [...document.querySelectorAll(".topic-item")].forEach(item => {
    const text = item.innerText.trim().toLowerCase();
    item.style.display = text.includes(q) ? "" : "none";
  });
}

function setAllTopics(checked) {
  document.querySelectorAll('#topicsWrap input[type="checkbox"]').forEach(i => {
    i.checked = checked;
  });
}

function updateProgress() {
  const total = state.questions.length || 1;
  const current = Math.min(state.current + 1, total);
  el("progressFill").style.width = `${(current / total) * 100}%`;
  el("progressText").textContent = `Question ${current} / ${total}`;
}

function formatTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function startTimer(minutes) {
  stopTimer();
  state.remainingSeconds = minutes * 60;
  el("timerText").textContent = formatTime(state.remainingSeconds);

  state.timerId = setInterval(() => {
    state.remainingSeconds -= 1;
    el("timerText").textContent = formatTime(Math.max(0, state.remainingSeconds));

    if (state.remainingSeconds <= 0) {
      stopTimer();
      submitExam();
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function renderQuestion() {
  const q = state.questions[state.current];
  if (!q) return;

  updateProgress();

  const selected = state.answers[q.id];
  const isPractice = state.mode === "practice";
  const bookmarked = !!state.bookmarks[q.id];

  el("questionArea").innerHTML = `
    <div class="question-top">
      <div>
        <div class="pill">${escapeHtml(state.mode === "practice" ? "Practice Mode" : "Real Exam Mode")}</div>
        <h2>${state.current + 1}) ${escapeHtml(q.question)}</h2>
        <p class="muted">${escapeHtml(q.topic)} • ${escapeHtml(q.difficulty)}</p>
      </div>

      <button id="bookmarkBtn" class="bookmark-btn ${bookmarked ? "active" : ""}" type="button">
        ${bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
      </button>
    </div>

    ${q.caseScenario ? `
      <div class="case-box">
        <strong>Case</strong>
        <div style="margin-top:8px;">${escapeHtml(q.caseScenario)}</div>
      </div>
    ` : ""}

    <div id="optionList" class="option-list"></div>
    <div id="practiceExtras"></div>

    <div class="action-row" style="margin-top:18px;">
      <button id="prevBtn" class="mini-btn" type="button" ${state.current === 0 ? "disabled" : ""}>Previous</button>
      <button id="nextBtn" class="primary-btn" type="button">${state.current === state.questions.length - 1 ? "Finish" : "Next"}</button>
    </div>
  `;

  const optionList = el("optionList");

  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn";
    btn.textContent = opt;

    if (selected === opt) btn.classList.add("selected");

    btn.addEventListener("click", () => {
      state.answers[q.id] = opt;
      if (isPractice) {
        showPracticeAnswer(q);
      } else {
        renderQuestion();
      }
    });

    optionList.appendChild(btn);
  });

  el("bookmarkBtn").addEventListener("click", () => {
    state.bookmarks[q.id] = !state.bookmarks[q.id];
    renderQuestion();
  });

  el("prevBtn").addEventListener("click", () => {
    if (state.current > 0) {
      state.current -= 1;
      renderQuestion();
    }
  });

  el("nextBtn").addEventListener("click", () => {
    if (state.current < state.questions.length - 1) {
      state.current += 1;
      renderQuestion();
    } else {
      submitExam();
    }
  });

  if (isPractice && selected) {
    showPracticeAnswer(q);
  }
}

function showPracticeAnswer(q) {
  const selected = state.answers[q.id];
  const correct = q.correctAnswer;
  const optionButtons = [...document.querySelectorAll(".option-btn")];

  optionButtons.forEach(btn => {
    btn.classList.remove("correct", "wrong");
    if (btn.textContent === correct) btn.classList.add("correct");
    if (btn.textContent === selected && selected !== correct) btn.classList.add("wrong");
  });

  el("practiceExtras").innerHTML = `
    <div class="answer-box">
      <strong>Correct Answer:</strong> ${escapeHtml(correct)}
      <div style="margin-top:8px;">${escapeHtml(q.explanation || "No explanation available.")}</div>
    </div>

    <div class="summary-box">
      <strong>Quick Summary</strong>
      <div style="margin-top:8px;">${escapeHtml(q.summary || "No summary available.")}</div>
    </div>
  `;
}

function buildReviewRows() {
  state.reviewRows = state.questions.map(q => {
    const selected = state.answers[q.id] || "No answer selected";
    const correct = q.correctAnswer;

    return {
      question: q,
      selected,
      correct,
      isCorrect: selected === correct
    };
  });
}

function submitExam() {
  stopTimer();
  buildReviewRows();
  renderReview();
}

function renderReview() {
  const correct = state.reviewRows.filter(r => r.isCorrect).length;
  const total = state.reviewRows.length;

  el("examShell").classList.add("hidden");
  el("reviewShell").classList.remove("hidden");
  el("reviewScore").textContent = `Score: ${correct} / ${total}`;

  el("reviewList").innerHTML = state.reviewRows.map((row, i) => `
    <div class="review-card">
      <h3>${i + 1}) ${escapeHtml(row.question.question)}</h3>
      ${row.question.caseScenario ? `<div class="case-box">${escapeHtml(row.question.caseScenario)}</div>` : ""}
      <p><strong>Your Answer:</strong> ${escapeHtml(row.selected)}</p>
      <p><strong>Correct Answer:</strong> ${escapeHtml(row.correct)}</p>
      <p class="${row.isCorrect ? "status-correct" : "status-wrong"}">
        ${row.isCorrect ? "Correct" : "Wrong"}
      </p>

      <div class="answer-box">
        <strong>Explanation</strong>
        <div style="margin-top:8px;">${escapeHtml(row.question.explanation || "No explanation available.")}</div>
      </div>

      <div class="summary-box">
        <strong>Quick Summary</strong>
        <div style="margin-top:8px;">${escapeHtml(row.question.summary || "No summary available.")}</div>
      </div>
    </div>
  `).join("");
}

function retryWrong() {
  const wrong = state.reviewRows.filter(r => !r.isCorrect).map(r => r.question);

  if (!wrong.length) {
    alert("No wrong questions to retry.");
    return;
  }

  state.questions = wrong;
  state.current = 0;
  state.answers = {};
  state.reviewRows = [];

  el("reviewShell").classList.add("hidden");
  el("examShell").classList.remove("hidden");
  el("modeBadge").textContent = "Retry Wrong";

  if (state.mode === "exam") {
    startTimer(Number(el("minutes").value || 20));
  }

  renderQuestion();
}

async function startExam() {
  try {
    const topics = getSelectedTopics();
    const count = Number(el("count").value || 10);
    const difficulty = el("difficulty").value;
    const minutes = Number(el("minutes").value || 20);
    const mode = el("mode").value;

    if (!topics.length) {
      el("setupMessage").innerHTML = `<p class="muted">Select at least one topic.</p>`;
      return;
    }

    const exam = await fetchExam({ topics, count, difficulty });

    state.questions = exam;
    state.current = 0;
    state.mode = mode;
    state.answers = {};
    state.bookmarks = {};
    state.reviewRows = [];

    el("setupCard").classList.add("hidden");
    el("reviewShell").classList.add("hidden");
    el("examShell").classList.remove("hidden");
    el("modeBadge").textContent = mode === "practice" ? "Practice Mode" : "Real Exam Mode";

    if (mode === "exam") {
      startTimer(minutes);
    } else {
      stopTimer();
      el("timerText").textContent = "--:--";
    }

    renderQuestion();
  } catch (e) {
    console.error(e);
    el("setupMessage").innerHTML = `<p class="muted">${escapeHtml(e.message)}</p>`;
  }
}

function backToSetup() {
  stopTimer();
  el("setupCard").classList.remove("hidden");
  el("examShell").classList.add("hidden");
  el("reviewShell").classList.add("hidden");
}

async function init() {
  try {
    state.topics = await fetchTopics();
    renderTopics(state.topics);

    el("topicSearch").addEventListener("input", (e) => {
      filterTopicsUI(e.target.value);
    });

    el("selectAllBtn").addEventListener("click", () => setAllTopics(true));
    el("clearAllBtn").addEventListener("click", () => setAllTopics(false));
    el("startBtn").addEventListener("click", startExam);
    el("retryWrongBtn").addEventListener("click", retryWrong);
    el("backSetupBtn").addEventListener("click", backToSetup);
    el("submitBtn").addEventListener("click", submitExam);
  } catch (e) {
    console.error(e);
    el("setupMessage").innerHTML = `<p class="muted">${escapeHtml(e.message)}</p>`;
  }
}

init();
