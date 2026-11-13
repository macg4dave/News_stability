// SPDX-FileCopyrightText: Copyright (c) 2025 Memos
// SPDX-License-Identifier: MIT
// getRelationBuckets is adapted from Memos
// web/src/components/MemoMetadata/Relation/relationHelpers.ts at
// 30f8bad87d586228381c54beea686162cd8c5265.
// Modified: use story hashes and explicit hyperlink edges on the loaded page,
// without memo types, React, persistence, or semantic relatedness inference.
// Full notice: /third-party-notices.txt and licenses/Memos-MIT.txt.

export function getRelationBuckets(relations, currentHash) {
  return relations.reduce((groups, relation) => {
    if (relation.source.hash === currentHash && relation.target.hash !== currentHash) {
      groups.referencing.push(relation.target);
    } else if (relation.source.hash !== currentHash && relation.target.hash === currentHash) {
      groups.referenced.push(relation.source);
    }
    return groups;
  }, { referencing: [], referenced: [] });
}

function linkIdentity(value) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}

// This is a temporary view of actual hyperlinks among the currently loaded
// stories. It does not fetch URLs, search a corpus, or cluster similar stories.
export function pageRelations(stories) {
  const byURL = new Map();
  for (const story of stories) {
    const identity = linkIdentity(story.url);
    if (!identity) continue;
    const matches = byURL.get(identity) || [];
    matches.push(story);
    byURL.set(identity, matches);
  }
  const edges = [];
  const seen = new Map();
  for (const source of stories) {
    const targets = seen.get(source.hash) || new Set();
    seen.set(source.hash, targets);
    for (const link of source.links || []) {
      for (const target of byURL.get(linkIdentity(link)) || []) {
        if (source.hash === target.hash || targets.has(target.hash)) continue;
        targets.add(target.hash);
        edges.push({ source, target });
      }
    }
  }
  return edges;
}
