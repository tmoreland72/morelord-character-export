import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const root = new URL("..", import.meta.url);

function read(relativePath) {
  return readFileSync(new URL(relativePath, root), "utf8");
}

function compareSemver(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function sectionFrom(markdown) {
  const section = [];
  let collecting = false;
  let found = false;
  for (const line of markdown.split(/\r?\n/)) {
    const normalized = line.replace(/[ \t]+$/g, "");
    const heading = normalized.match(/^##\s+(\S.*)$/);
    if (heading) {
      if (heading[1].trim() === "What Changed") {
        collecting = true;
        found = true;
        continue;
      }
      if (collecting) break;
      continue;
    }
    if (!collecting) continue;
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(normalized)) continue;
    section.push(normalized
      .replace(/^(#{1,6})([^#\s])/, "$1 $2")
      .replace(/^(\s*)[*+]\s+(.*)$/, "$1- $2"));
  }
  if (!found) throw new Error("Release notes are missing ## What Changed");
  while (section.length > 0 && section[0].trim() === "") section.shift();
  while (section.length > 0 && section.at(-1).trim() === "") section.pop();
  return section;
}

function buildChangelog() {
  const title = JSON.parse(read("module.json")).title;
  const notes = readdirSync(new URL("release-notes/", root))
    .filter(name => /^RELEASE-NOTES-\d+\.\d+\.\d+\.md$/.test(name))
    .map(name => ({ name, version: name.slice("RELEASE-NOTES-".length, -".md".length) }))
    .sort((a, b) => compareSemver(b.version, a.version));
  const lines = [`# ${title} Changelog`, ""];
  for (const note of notes) {
    lines.push(`## ${note.version}`, "", ...sectionFrom(read(`release-notes/${note.name}`)), "");
  }
  return lines.join("\n");
}

test("root CHANGELOG.md matches release notes for in-Foundry viewers", () => {
  const changelog = read("CHANGELOG.md");
  assert.equal(changelog, buildChangelog());
  assert.equal(changelog.includes("\r"), false);
  assert.equal(changelog.endsWith("\n"), true);
  assert.equal(changelog.endsWith("\n\n"), false);
  assert.equal(/^---\s*$/m.test(changelog), false);
  assert.equal(changelog.includes("Shop Manager was visually reviewed"), false);
  assert.equal(changelog.includes("Legacy rarity compatibility"), false);
  assert.equal(changelog.includes("Foundry VTT v14 only"), false);
  assert.deepEqual(
    [...changelog.matchAll(/^## (\d+\.\d+\.\d+)$/gm)].map(match => match[1]),
    ["0.3.6", "0.3.5", "0.3.4", "0.3.3"]
  );
  for (const line of changelog.split("\n")) {
    if (/^#{1,6}/.test(line)) assert.match(line, /^#{1,6} /);
    if (/^\s*[-*+] /.test(line)) assert.match(line, /^\s*- /);
  }
});

test("semantic versions sort numerically", () => {
  assert.ok(compareSemver("0.3.10", "0.3.6") > 0);
  assert.ok(compareSemver("0.10.0", "0.9.0") > 0);
});
