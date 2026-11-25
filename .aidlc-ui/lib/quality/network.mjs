// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Static network scan of prototype.html (patterns of the P3 probe) and the runtime request policy.

// SVG / XHTML / XLink namespace URIs are not network use.
const NS_OK = /^https?:\/\/www\.w3\.org\/(2000\/svg|1999\/xhtml|1999\/xlink|2000\/xmlns|XML\/1998\/namespace)\/?$/;
const NET_PATTERNS = [
  [/\bfetch\s*\(/g, 'fetch()'], [/XMLHttpRequest/g, 'XMLHttpRequest'], [/\bWebSocket\s*\(/g, 'WebSocket'],
  [/\bEventSource\s*\(/g, 'EventSource'], [/sendBeacon/g, 'sendBeacon'], [/importScripts\s*\(/g, 'importScripts'],
  [/navigator\.serviceWorker/g, 'serviceWorker'], [/@import/g, '@import'], [/<script[^>]*\bsrc\s*=/gi, '<script src>'],
  [/<link[^>]*\bhref\s*=\s*["']?https?:/gi, '<link href=http(s)>'],
  [/<(?:img|iframe|video|audio|source)[^>]*\bsrc\s*=\s*["']?https?:/gi, '<img|iframe|video|audio src=http(s)>'],
];

export function staticNetworkScan(html) {
  const urls = [...html.matchAll(/https?:\/\/[^\s"'<>)`\\]+/g)]
    .map((m) => m[0].replace(/[.,;]+$/, ''))
    .filter((u) => !NS_OK.test(u));
  const patterns = [];
  for (const [re, label] of NET_PATTERNS) {
    const n = (html.match(re) || []).length;
    if (n) patterns.push({ pattern: label, count: n });
  }
  return { urls: [...new Set(urls)], patterns };
}

/** Decide what the page may request: returns 'allow' | 'external' | 'extra-file'. */
export function classifyRequest(url, origin) {
  if (/^(data:|blob:|about:)/.test(url)) return 'allow';
  if (url.startsWith(origin + '/') || url === origin) {
    const path = new URL(url).pathname;
    return path === '/prototype.html' || path === '/favicon.ico' ? 'allow' : 'extra-file';
  }
  return 'external';
}
