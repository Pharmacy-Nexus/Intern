const { extractLocalDrugs } = require('./normalizer');

function isShortGreeting(text = '') {
  const t = String(text || '').trim().toLowerCase();
  return /^(hi|hello|hey|السلام عليكم|اهلا|أهلا|ازيك|عامل ايه|هاي|هلا|صباح الخير|مساء الخير)[!.؟\s]*$/.test(t);
}

function greetingReply() {
  return 'Hi 👋 I’m Nexus. How can I help?';
}

function isGeneralKnowledgeQuestion(text = '') {
  const t = String(text).toLowerCase();
  return /what is|explain|difference between|define|meaning|active ingredient|excipient|manufactur|formulation|herb|plant|mechanism of action|class of|ما هي|ما هو|يعني ايه|اشرح|الفرق|المادة الفعالة|مادة فعالة|مادة اضافية|مادة إضافية|سواغ|تصنيع|تركيبة|نبتة|نبات|استخدام/.test(t);
}

function detectModeFromText(text = '', data) {
  const t = String(text).toLowerCase();
  const hasDrug = extractLocalDrugs(text, data).length > 0;

  if (/reverse|quiz|train|scenario|clue|guess|interactive|عكس|تدريب|اختبرني|اختبار/.test(t)) return 'drug_reverse';

  const explicitInteraction = /\b(interaction|interact|contraindication|combine|together|safe with|with)\b|\+|مع بعض|ينفع مع|تداخل|تفاعل|يتعارض|تعارض/.test(t);
  if (hasDrug && explicitInteraction) return 'drug_interaction';

  const clearCase = /patient|case|year-old|y\/o|male|female|serum|creatinine|egfr|potassium\s*[=:]?\s*\d|sodium|bp\s*[=:]|hr\s*[=:]|labs|diagnosis|symptoms|pregnan|مريض|حالة|تحاليل|كرياتينين|ضغطه|سكره|حامل|الأعراض|اعراض/.test(t);
  if (clearCase) return 'case_analysis';

  return 'general_chat';
}

function isMedicalInScope(text = '', data) {
  const t = String(text || '').toLowerCase();
  if (isShortGreeting(t)) return true;
  if (extractLocalDrugs(text, data).length) return true;
  const medicalTerms = [
    'drug', 'medicine', 'medication', 'dose', 'dosage', 'side effect', 'adverse', 'interaction', 'contraindication', 'pharmacy', 'pharmacology', 'pharmacist', 'clinical', 'patient', 'case', 'lab', 'labs', 'diagnosis', 'symptom', 'treatment', 'therapy', 'monitoring', 'pregnancy', 'renal', 'hepatic', 'kidney', 'liver', 'blood pressure', 'glucose', 'insulin', 'warfarin', 'antibiotic', 'analgesic', 'guideline', 'study pharmacology', 'active ingredient', 'excipient', 'formulation', 'manufacturing',
    'دواء', 'ادوية', 'أدوية', 'دوا', 'جرعة', 'اعراض', 'أعراض', 'تفاعل', 'تداخل', 'صيدلة', 'صيدلي', 'مريض', 'حالة', 'تحاليل', 'تحليل', 'تشخيص', 'علاج', 'مضاد', 'حامل', 'حمل', 'ضغط', 'سكر', 'كلى', 'كلية', 'كبد', 'حساسية', 'موانع', 'متابعة', 'مذاكرة فارما', 'فارما', 'كلينيكال', 'طبي', 'ميديكال', 'مادة فعالة', 'مادة إضافية', 'مادة اضافية', 'سواغ', 'تصنيع', 'تركيبة'
  ];
  return medicalTerms.some(term => t.includes(term));
}

function outOfScopeReply(text = '') {
  if (isShortGreeting(text)) return greetingReply();
  return `## Out of scope\nI can only help with medical, pharmacy, clinical, drug-safety, pharmacology, formulation, and patient-case questions.\n\nPlease rephrase your question within the medical/pharmacy field.`;
}

module.exports = { isShortGreeting, greetingReply, isGeneralKnowledgeQuestion, detectModeFromText, isMedicalInScope, outOfScopeReply };
