// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Functions that run INSIDE the page for the seed-fidelity pass (page.evaluate serialises them: no outer references allowed).

/** Reads what the page holds: window.CANON, the canonical collections of window.APP_DATA, its kpis. names = collection names of the seed. */
export function readSeedState(names) {
  const clean = (x) => { try { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); } catch (e) { return undefined; } };
  const data = window.APP_DATA && typeof window.APP_DATA === 'object' ? window.APP_DATA : null;
  const out = { canon: clean(window.CANON) || null, data: {}, kpis: undefined, hasData: !!data };
  for (const n of names) out.data[n] = data ? clean(data[n]) : undefined;
  if (data && data.kpis && typeof data.kpis === 'object') out.kpis = clean(data.kpis);
  return out;
}

/** The visible text of every element matching a selector (an agree rule with a "selector" hint). */
export function readSelectorTexts(selector) {
  const out = [];
  let nodes = [];
  try { nodes = [...document.querySelectorAll(selector)]; } catch (e) { return out; }
  for (const el of nodes) {
    const visible = (() => { try { return el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }); } catch (e) { return !!(el.offsetWidth || el.offsetHeight); } })();
    if (visible) out.push((el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200));
  }
  return out;
}
