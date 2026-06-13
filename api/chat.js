const API_URL =
  process.env.NVIDIA_API_URL ||
  "https://integrate.api.nvidia.com/v1/chat/completions";

const MODEL =
  process.env.NVIDIA_MODEL ||
  "moonshotai/kimi-k2.6";

function detectMode(text = "") {
  const t = text.toLowerCase();

  if (
    /pdf|report|summary|summarize|export/i.test(t)
  ) {
    return "report_mode";
  }

  if (
    /interaction|interact|contraindication|safe with|combine|together|drug-related problem/i.test(t)
  ) {
    return "drug_safety";
  }

  if (
    /year-old|male|female|yo|y\/o|serum|creatinine|egfr|potassium|sodium|bp|hr|diagnosis|taking|medications|labs|k\s*=|na\s*=|glucose|patient/i.test(t)
  ) {
    return "case_analysis";
  }

  if (
    /explain|what is|mechanism|uses|dose|dosing|side effect|counsel|monitoring|brand|class/i.test(t)
  ) {
    return "drug_info";
  }

  return "general_chat";
}

function buildPrompt(mode) {
  const base = `
You are Nexus Clinical Pharmacist AI.
You help pharmacists understand cases, drugs, interactions, and make structured clinical summaries.
Rules:
- Do not hallucinate references.
- If information is missing, clearly say what is missing.
- Be clinically practical and pharmacist-focused.
- Respond in English unless the user wrote in Arabic.
- Keep answers clear and structured.
`;

  const prompts = {
    general_chat: `
${base}
Use a helpful pharmacist tone.
If the question is casual/general, answer naturally and briefly.
If the topic becomes clinical, structure it clearly.
`,

    drug_info: `
${base}
The user is asking for drug information.
Use these headings exactly:
Overview
Mechanism
Main Uses
Key Warnings
Monitoring
Patient Counseling
Confidence Level
`,

    drug_safety: `
${base}
The user is asking about drug safety / interaction / medication problems.
Use these headings exactly:
Interaction Summary
Clinical Assessment
Drug Related Problems
Missing Information
Recommendations
Patient Counseling
Confidence Level
`,

    case_analysis: `
${base}
The user is presenting a patient case.
Use these headings exactly:
Case Summary
Clinical Assessment
Drug Related Problems
Missing Information
Recommendations
Patient Counseling
Confidence Level
Focus on pharmacist reasoning, medication-related problems, labs, monitoring, and red flags.
`,

    report_mode: `
${base}
The user wants a report or summary.
Create a clean professional report with these headings if relevant:
Report
Case Summary
Clinical Assessment
Drug Related Problems
Recommendations
Patient Counseling
Confidence Level
Make it polished and ready to export as PDF.
`
  };

  return prompts[mode] || prompts.general_chat;
}

function getLatestUserMessage(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content || "";
  }
  return "";
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) {
      if (typeof req.body === "string") {
        try {
          return resolve(JSON.parse(req.body));
        } catch (err) {
          return reject(err);
        }
      }
      return resolve(req.body);
    }

    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = await parseRequestBody(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const latestUserText = getLatestUserMessage(messages);

    if (!latestUserText) {
      return res.status(400).json({ error: "No user message found." });
    }

    const mode = detectMode(latestUserText);
    const systemPrompt = buildPrompt(mode);

    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role,
          content: m.content
        }))
    ];

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        model: MODEL,
        messages: apiMessages,
        max_tokens: 1400,
        temperature: 0.3,
        top_p: 0.9,
        stream: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: `NVIDIA API failed (${response.status})`,
        details: data
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content ||
      "No response returned from the model.";

    return res.status(200).json({
      mode,
      reply
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
};
