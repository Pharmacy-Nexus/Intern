function buildSafetyValidation(parsed, evidence, triage) {
  const flags = [];
  const mandatoryActions = [];
  const missing = parsed.missingCriticalInfo || [];

  if (triage.level === 'emergency') {
    flags.push('emergency_triage');
    mandatoryActions.push('Clearly advise urgent medical assessment for the emergency red flags detected. Do not present the case as routine.');
  }

  for (const interaction of evidence.interactions || []) {
    if (['high', 'moderate_to_high', 'contraindicated', 'major'].includes(interaction.severity)) {
      flags.push(`high_risk_interaction:${interaction.id}`);
      mandatoryActions.push(`For ${interaction.drugs.join(' + ')}: mention ${interaction.risk}, required monitoring, and avoid reassuring language.`);
    }
  }

  if (missing.length) {
    flags.push('missing_critical_info');
    mandatoryActions.push(`Do not give a definitive patient-specific recommendation until missing critical data are addressed: ${missing.join(', ')}.`);
  }

  return { flags: Array.from(new Set(flags)), mandatoryActions: Array.from(new Set(mandatoryActions)) };
}

function resolveConflicts(evidence) {
  const notes = [];
  const severities = (evidence.interactions || []).map(i => i.severity).filter(Boolean);
  if (severities.includes('high') && severities.includes('low')) {
    notes.push('When evidence severity differs, use the more conservative severity for safety.');
  }
  return { notes };
}

function compactPipelineContext({ mode, parsed, evidence, triage, validation, conflictResolver }) {
  return {
    mode,
    detected_intent: parsed.intent,
    parser: parsed.parser,
    parser_confidence: parsed.confidence,
    patient_context: parsed.patientFactors,
    labs: parsed.labs,
    detected_drugs: parsed.drugs,
    missing_critical_info: parsed.missingCriticalInfo,
    risk_triage: triage,
    evidence: {
      drug_monographs: (evidence.monographs || []).map(m => ({
        generic: m.generic,
        class: m.class,
        key_warnings: m.key_warnings,
        monitoring: m.monitoring,
        source: m.source
      })),
      matched_interactions: (evidence.interactions || []).map(i => ({
        id: i.id,
        drugs: i.drugs,
        severity: i.severity,
        risk: i.risk,
        mechanism: i.mechanism,
        recommendation: i.recommendation,
        monitoring: i.monitoring,
        patient_factor_amplifiers: i.patient_factor_amplifiers,
        source: i.source
      })),
      pairwise_matrix_seed: (evidence.pairwise || []).map(p => ({
        pair: p.pair,
        severity: p.interaction?.severity || 'none_known',
        id: p.interaction?.id || null,
        risk: p.interaction?.risk || null
      })),
      clinical_rules: (evidence.clinicalRules || []).map(r => ({
        id: r.id,
        name: r.name,
        risk: r.risk,
        required_info: r.required_info,
        safety_action: r.safety_action,
        source: r.source
      })),
      sources: evidence.sources || []
    },
    conflict_resolution: conflictResolver,
    safety_validation: validation,
    instructions_to_composer: [
      'Use the evidence brief above as the primary source of truth.',
      'Do not claim a patient-specific decision is safe when critical data are missing.',
      'No ASCII diagrams, terminal blocks, or code blocks in clinical answers.',
      'For General Chat, avoid clinical-case headings unless the user asks for a structured assessment.',
      'Do not end with a generic question like “Would you like more details?”. Put any follow-up options only under Related questions.'
    ]
  };
}

function buildEvidenceBrief(args) {
  const validation = buildSafetyValidation(args.parsed, args.evidence, args.triage);
  const conflictResolver = resolveConflicts(args.evidence);
  const pipelineContext = compactPipelineContext({
    mode: args.mode,
    parsed: args.parsed,
    evidence: args.evidence,
    triage: args.triage,
    validation,
    conflictResolver
  });
  return { validation, conflictResolver, pipelineContext };
}

module.exports = { buildSafetyValidation, resolveConflicts, compactPipelineContext, buildEvidenceBrief };
