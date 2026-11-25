// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Pure: reduce a Lighthouse result (lhr) to what the report needs. Exported for unit tests (no Lighthouse import).
export function summariseLhr(lhr) {
  const cat = lhr.categories && lhr.categories.accessibility;
  if (!cat || cat.score === null || cat.score === undefined) return { score: null, failing: [] };
  const failing = [];
  for (const ref of cat.auditRefs || []) {
    const a = lhr.audits[ref.id];
    if (!a || !(ref.weight > 0) || a.score === null || a.score >= 1) continue;
    const items = (a.details && a.details.items) || [];
    failing.push({
      id: ref.id,
      title: a.title,
      weight: ref.weight,
      nodes: items.length,
      examples: items.slice(0, 3).map((it) => ({
        selector: (it.node && it.node.selector) || '',
        detail: String((it.node && it.node.explanation) || '').split('\n').find((l) => l.trim()) || '',
      })),
    });
  }
  failing.sort((x, y) => y.weight - x.weight);
  return { score: Math.round(cat.score * 100), failing };
}
