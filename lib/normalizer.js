function getAliasIndex(data) {
  const index = [];
  for (const [generic, aliases] of Object.entries(data.aliases || {})) {
    [generic, ...(aliases || [])].forEach(alias => {
      if (!alias) return;
      index.push({ generic, alias: String(alias).toLowerCase() });
    });
  }
  index.sort((a, b) => b.alias.length - a.alias.length);
  return index;
}

function containsLoose(text, phrase) {
  const lower = String(text || '').toLowerCase();
  const escaped = String(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ascii = /^[a-z0-9\-\s]+$/i.test(phrase);
  if (ascii) return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(lower);
  return lower.includes(String(phrase).toLowerCase());
}

function extractLocalDrugs(text = '', data) {
  const found = new Set();
  for (const item of getAliasIndex(data)) {
    if (containsLoose(text, item.alias)) found.add(item.generic);
  }
  return Array.from(found);
}

function normalizeDrugList(items = [], data) {
  const found = new Set();
  const aliasIndex = getAliasIndex(data);
  for (const value of items) {
    const text = String(value || '').toLowerCase().trim();
    if (!text) continue;
    if (data.monographs?.[text]) {
      found.add(text);
      continue;
    }
    const exact = aliasIndex.find(item => item.alias === text);
    if (exact) {
      found.add(exact.generic);
      continue;
    }
    const loose = aliasIndex.find(item => text.includes(item.alias) || item.alias.includes(text));
    if (loose) found.add(loose.generic);
  }
  return Array.from(found);
}

function getDrugClass(generic, data) {
  return data.monographs?.[generic]?.class || '';
}

module.exports = { getAliasIndex, containsLoose, extractLocalDrugs, normalizeDrugList, getDrugClass };
