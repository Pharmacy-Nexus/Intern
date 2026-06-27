const { loadClinicalData } = require('../lib/data');
const { detectModeFromText, isGeneralKnowledgeQuestion, isMedicalInScope, isShortGreeting, greetingReply, outOfScopeReply } = require('../lib/detector');
const { localParseQuestion, inheritContextIfNeeded, getRecentContextText, inferMissingInfo } = require('../lib/parser');
const { normalizeDrugList } = require('../lib/normalizer');
const { retrieveEvidence, triageRisk } = require('../lib/engines');
const { buildEvidenceBrief } = require('../lib/evidenceBrief');
const { callFinalModel, relayNvidiaStream, localFallbackAnswer } = require('../lib/composer');

const MODE_LABELS = {
  general_chat: 'General Chat',
  case_analysis: 'Case Analysis',
  drug_interaction: 'Drug Interaction',
  drug_reverse: 'Drug Reverse Interactive Training'
};

const DATA = loadClinicalData();

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); }
        catch (error) { return reject(error); }
      }
      return resolve(req.body);
    }
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (error) { reject(error); }
    });
    req.on('error', reject);
  });
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getLatestUserText(messages = []) {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return String(messages[i].content || '');
  }
  return '';
}

function attachmentContext(messages = []) {
  const blocks = [];
  messages.forEach((message, index) => {
    const files = Array.isArray(message.attachments) ? message.attachments : [];
    if (!files.length) return;
    const fileText = files.map(file => {
      const header = `File: ${file.name || 'untitled'} | Type: ${file.type || 'unknown'} | Size: ${file.size || 0} bytes`;
      if (file.text) return `${header}\nContent:\n${file.text}`;
      return `${header}\nContent not extracted. The user must paste text or use supported text files for clinical interpretation.`;
    }).join('\n\n');
    blocks.push(`Attachments linked to message ${index + 1}:\n${fileText}`);
  });
  return blocks.length ? `\n\nAttachment context:\n${blocks.join('\n\n---\n\n')}` : '';
}

function safeParseJson(text) {
  try { return JSON.parse(text); }
  catch { return null; }
}

function sendPlainText(res, text, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform'
  });
  res.end(text);
}

function resolveMode(selectedMode, detectedMode, latestUserText) {
  let mode = MODE_LABELS[selectedMode] ? selectedMode : 'general_chat';
  // Strong tool signals auto-switch the UI and response style.
  if (detectedMode !== 'general_chat') mode = detectedMode;
  // A user-selected Case mode stays Case unless the text is clearly general knowledge.
  if (selectedMode === 'case_analysis' && detectedMode === 'general_chat' && !isGeneralKnowledgeQuestion(latestUserText)) mode = 'case_analysis';
  // General medical/pharmacy education is not a case.
  if (isGeneralKnowledgeQuestion(latestUserText) && detectedMode === 'general_chat') mode = 'general_chat';
  return mode;
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.NVIDIA_API_KEY) return res.status(500).json({ error: 'Missing NVIDIA_API_KEY environment variable.' });

  try {
    const body = await parseRequestBody(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const latestUserText = getLatestUserText(messages);
    if (!latestUserText) return res.status(400).json({ error: 'No user message found.' });

    const shouldStream = body.stream !== false;

    if (isShortGreeting(latestUserText)) {
      const reply = greetingReply();
      res.setHeader('X-Nexus-Mode', 'general_chat');
      res.setHeader('X-Nexus-Risk', 'none');
      return shouldStream ? sendPlainText(res, reply) : res.status(200).json({ mode: 'general_chat', risk: 'none', reply });
    }

    if (!isMedicalInScope(latestUserText, DATA)) {
      const reply = outOfScopeReply(latestUserText);
      res.setHeader('X-Nexus-Mode', 'scope_guard');
      res.setHeader('X-Nexus-Risk', 'none');
      return shouldStream ? sendPlainText(res, reply) : res.status(200).json({ mode: 'scope_guard', risk: 'none', reply });
    }

    const detectedMode = detectModeFromText(latestUserText, DATA);
    const selectedMode = MODE_LABELS[body.mode] ? body.mode : 'general_chat';
    const mode = resolveMode(selectedMode, detectedMode, latestUserText);
    const attachmentText = attachmentContext(messages);
    const recentContextText = getRecentContextText(messages, 8);

    let parsed = localParseQuestion({ text: latestUserText, mode, data: DATA });
    parsed.drugs = normalizeDrugList(parsed.drugs || [], DATA);
    parsed = inheritContextIfNeeded({ parsed, latestUserText, messages, data: DATA });
    parsed.missingCriticalInfo = Array.from(new Set([...(parsed.missingCriticalInfo || []), ...inferMissingInfo(parsed)]));

    const evidence = retrieveEvidence(parsed, DATA, `${latestUserText}\n${recentContextText}`);
    const triage = triageRisk(parsed, evidence, latestUserText, DATA);
    const { validation, conflictResolver, pipelineContext } = buildEvidenceBrief({ mode, parsed, evidence, triage });

    let upstream;
    try {
      upstream = await callFinalModel({
        mode,
        modeInstruction: body.modeInstruction,
        messages,
        pipelineContext,
        attachmentText,
        shouldStream
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        const fallbackReply = localFallbackAnswer({ parsed, evidence, triage, validation });
        res.setHeader('X-Nexus-Mode', mode);
        res.setHeader('X-Nexus-Risk', triage.level);
        res.setHeader('X-Nexus-Fallback', 'composer_timeout');
        return shouldStream ? sendPlainText(res, fallbackReply) : res.status(200).json({ mode, risk: triage.level, reply: fallbackReply, fallback: 'composer_timeout' });
      }
      throw error;
    }

    if (!upstream.ok) {
      const errorText = await upstream.text();
      return res.status(upstream.status).json({
        error: `NVIDIA API failed (${upstream.status})`,
        details: safeParseJson(errorText) || errorText.slice(0, 500),
        pipeline: process.env.NEXUS_DEBUG_PIPELINE === 'true' ? pipelineContext : undefined
      });
    }

    res.setHeader('X-Nexus-Mode', mode);
    res.setHeader('X-Nexus-Risk', triage.level);
    res.setHeader('X-Nexus-Parser', parsed.parser || 'local_tool_layer');

    if (shouldStream && upstream.body) {
      const emptyStreamFallback = localFallbackAnswer({ parsed, evidence, triage, validation });
      return relayNvidiaStream(upstream, res, emptyStreamFallback);
    }

    const data = await upstream.json();
    const reply = data?.choices?.[0]?.message?.content || localFallbackAnswer({ parsed, evidence, triage, validation });
    return res.status(200).json({
      mode,
      risk: triage.level,
      reply,
      evidenceBrief: process.env.NEXUS_DEBUG_PIPELINE === 'true' ? pipelineContext : undefined
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
