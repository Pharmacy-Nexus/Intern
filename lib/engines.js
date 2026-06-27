const { getDrugClass } = require('./normalizer');

function makePairs(items = []) {
  const pairs = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) pairs.push([items[i], items[j]]);
  }
  return pairs;
}

function sameSet(a = [], b = []) {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every(item => set.has(item));
}

function includesAll(haystack = [], needles = []) {
  const set = new Set(haystack);
  return needles.every(item => set.has(item));
}

function runInteractionEngine(parsed, data) {
  const drugs = parsed.drugs || [];
  const matches = [];
  for (const record of data.interactions || []) {
    if (includesAll(drugs, record.drugs || [])) matches.push(record);
  }
  const pairwise = makePairs(drugs).map(pair => ({
    pair,
    interaction: (data.interactions || []).find(record => sameSet(record.drugs || [], pair)) || null
  }));
  return { matches, pairwise };
}

function triggerClinicalRules(parsed, data, latestUserText = '') {
  const drugs = parsed.drugs || [];
  const monographs = drugs.map(drug => data.monographs?.[drug]).filter(Boolean);
  const lower = String(latestUserText).toLowerCase();
  return (data.clinicalRules || []).filter(rule => {
    const classHit = (rule.trigger_drug_classes || []).some(cls => monographs.some(m => m.class === cls));
    const termHit = (rule.trigger_terms || []).some(term => lower.includes(String(term).toLowerCase()));
    return classHit || termHit;
  });
}

function retrieveEvidence(parsed, data, latestUserText = '') {
  const drugs = parsed.drugs || [];
  const monographs = drugs.map(drug => data.monographs?.[drug]).filter(Boolean);
  const interactionEngine = runInteractionEngine(parsed, data);
  const clinicalRules = triggerClinicalRules(parsed, data, latestUserText);
  const sources = [
    ...monographs.map(m => m.source),
    ...interactionEngine.matches.map(i => i.source),
    ...clinicalRules.map(r => r.source)
  ].filter(Boolean);
  return {
    monographs,
    interactions: interactionEngine.matches,
    pairwise: interactionEngine.pairwise,
    clinicalRules,
    sources: Array.from(new Set(sources))
  };
}

function triageRisk(parsed, evidence, text = '', data) {
  const lower = String(text).toLowerCase();
  const emergencyHits = (data.riskKeywords.emergency || []).filter(k => lower.includes(String(k).toLowerCase()));
  const highHits = (data.riskKeywords.high || []).filter(k => lower.includes(String(k).toLowerCase()));
  const moderateHits = (data.riskKeywords.moderate || []).filter(k => lower.includes(String(k).toLowerCase()));
  const severeInteractions = (evidence.interactions || []).filter(i => ['high', 'contraindicated', 'major', 'moderate_to_high'].includes(i.severity));
  const labs = parsed.labs || {};
  if (typeof labs.serumPotassium === 'number' && labs.serumPotassium >= 6) emergencyHits.push('serum potassium >= 6');
  if (typeof labs.serumPotassium === 'number' && labs.serumPotassium >= 5.5) highHits.push('hyperkalemia range potassium');
  if (typeof labs.eGFR === 'number' && labs.eGFR < 30) highHits.push('eGFR < 30');
  if (parsed.patientFactors?.pregnancy === true) highHits.push('pregnancy');
  let level = 'low';
  if (moderateHits.length) level = 'moderate';
  if (highHits.length || severeInteractions.length) level = 'high';
  if (emergencyHits.length) level = 'emergency';
  return {
    level,
    emergencyHits: Array.from(new Set(emergencyHits)),
    highHits: Array.from(new Set(highHits)),
    moderateHits: Array.from(new Set(moderateHits)),
    severeInteractions: severeInteractions.map(i => i.id)
  };
}

module.exports = { makePairs, sameSet, includesAll, runInteractionEngine, retrieveEvidence, triageRisk };
