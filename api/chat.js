const API_URL = process.env.NVIDIA_API_URL || "https://integrate.api.nvidia.com/v1/chat/completions";
const MODEL = process.env.NVIDIA_MODEL || "moonshotai/kimi-k2.6";

const MODE_LABELS = {
  general_chat: "General Chat",
  case_analysis: "Case Analysis",
  drug_interaction: "Drug Interaction",
  drug_reverse: "Drug Reverse Interactive Training"
};

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) {
      if (typeof req.body === "string") {
        try { return resolve(JSON.parse(req.body)); }
        catch (error) { return reject(error); }
      }
      return resolve(req.body);
    }

    let data = "";
    req.on("data", chunk => { data += chunk; });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function detectModeFromText(text = "") {
  const t = String(text).toLowerCase();
  if (/reverse|quiz|train|scenario|clue|guess|interactive|عكس|تدريب/.test(t)) return "drug_reverse";
  if (/interaction|interact|contraindication|combine|together|warfarin|amiodarone|safety|تداخل|تفاعل|مع بعض/.test(t)) return "drug_interaction";
  if (/patient|case|year-old|y\/o|male|female|serum|creatinine|egfr|potassium|sodium|bp|hr|labs|مريض|حالة|تحاليل/.test(t)) return "case_analysis";
  return "general_chat";
}

function getLatestUserText(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return messages[i].content || "";
  }
  return "";
}

function attachmentContext(messages = []) {
  const blocks = [];
  messages.forEach((message, index) => {
    const files = Array.isArray(message.attachments) ? message.attachments : [];
    if (!files.length) return;
    const fileText = files.map(file => {
      const header = `File: ${file.name || "untitled"} | Type: ${file.type || "unknown"} | Size: ${file.size || 0} bytes`;
      if (file.text) return `${header}\nContent:\n${file.text}`;
      return `${header}\nContent not extracted. Ask the user to paste text from this file if clinical details are needed.`;
    }).join("\n\n");
    blocks.push(`Attachments linked to message ${index + 1}:\n${fileText}`);
  });
  return blocks.length ? `\n\nAttachment context:\n${blocks.join("\n\n---\n\n")}` : "";
}

function buildSystemPrompt(mode, modeInstruction = "") {
  const label = MODE_LABELS[mode] || MODE_LABELS.general_chat;
  const base = `
You are Nexus Clinical Pharmacist AI, a professional clinical pharmacy assistant.
Active mode: ${label}.

Core rules:
- Respond in the same language as the user unless they ask otherwise.
- Be concise, structured, practical, and pharmacist-focused.
- Never invent references, lab results, diagnoses, or patient details.
- If important information is missing, say exactly what is missing and why it matters.
- Flag red flags and urgent referral situations clearly.
- Use Markdown headings, bullet points, and tables when helpful.
- Use callouts with this exact format for important notes: > [!INFO] text, > [!WARNING] text, or > [!IMPORTANT] text.
- End clinical answers with a short confidence statement based on the information provided.
- This is educational decision support, not a replacement for clinician judgement or local protocols.
`;

  const modePrompts = {
    general_chat: `
For General Chat:
Answer naturally without forcing a tool format.
If the user asks a clinical or pharmacy question, keep it practical and safe, but only use headings when they help.
`,
    case_analysis: `
For Case Analysis:
Use these headings when relevant:
### Case Summary
### Clinical Assessment
### Drug-Related Problems
### Missing Information
### Recommendations
### Monitoring / Follow-up
### Patient Counseling
### Confidence
Focus on patient factors, medication problems, labs, monitoring, and safe next steps.
`,
    drug_interaction: `
For Drug Interaction:
Use these headings when relevant:
### Interaction Summary
### Severity
### Mechanism
### Clinical Risk
### What to Check
### Recommendations
### Safer Alternatives
### Counseling
### Confidence
Be specific about whether the combination is contraindicated, avoid, monitor, or usually acceptable.
`,
    drug_reverse: `
For Drug Reverse Interactive Training:
Do not reveal the full answer immediately unless the user asks.
Start with a short scenario or clues, then ask the user one focused question.
After the user answers, correct them and add the next clue.
Keep it interactive and educational.
`
  };

  return `${base}\n${modePrompts[mode] || modePrompts.case_analysis}\n${modeInstruction ? `User-selected mode instruction:\n${modeInstruction}` : ""}`;
}

function normalizeMessages(messages = []) {
  return messages
    .filter(message => message && (message.role === "user" || message.role === "assistant"))
    .map(message => ({
      role: message.role,
      content: String(message.content || "")
    }));
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function relayNvidiaStream(upstream, res) {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") {
        res.end();
        return;
      }
      try {
        const json = JSON.parse(data);
        const token = json?.choices?.[0]?.delta?.content || "";
        if (token) res.write(token);
      } catch {
        // Ignore malformed SSE fragments.
      }
    }
  }

  res.end();
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.NVIDIA_API_KEY) return res.status(500).json({ error: "Missing NVIDIA_API_KEY environment variable." });

  try {
    const body = await parseRequestBody(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const latestUserText = getLatestUserText(messages);
    if (!latestUserText) return res.status(400).json({ error: "No user message found." });

    const mode = body.mode || detectModeFromText(latestUserText);
    const systemPrompt = buildSystemPrompt(mode, body.modeInstruction);
    const attachments = attachmentContext(messages);

    const apiMessages = [
      { role: "system", content: systemPrompt + attachments },
      ...normalizeMessages(messages)
    ];

    const shouldStream = body.stream !== false;
    const upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: shouldStream ? "text/event-stream" : "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: apiMessages,
        max_tokens: Number(process.env.NVIDIA_MAX_TOKENS || 1800),
        temperature: Number(process.env.NVIDIA_TEMPERATURE || 0.25),
        top_p: Number(process.env.NVIDIA_TOP_P || 0.9),
        stream: shouldStream
      })
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      return res.status(upstream.status).json({
        error: `NVIDIA API failed (${upstream.status})`,
        details: safeParseJson(errorText) || errorText.slice(0, 500)
      });
    }

    if (shouldStream && upstream.body) {
      return relayNvidiaStream(upstream, res);
    }

    const data = await upstream.json();
    const reply = data?.choices?.[0]?.message?.content || "No response returned from the model.";
    return res.status(200).json({ mode, reply });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
};

function safeParseJson(text) {
  try { return JSON.parse(text); }
  catch { return null; }
}
