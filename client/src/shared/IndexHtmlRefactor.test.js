import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const indexHtmlPath = path.resolve(process.cwd(), 'client/index.html');
const indexCssPath = path.resolve(process.cwd(), 'client/src/styles/index.css');
const coreCssPath = path.resolve(process.cwd(), 'client/src/styles/core.css');
const gamesCssPath = path.resolve(process.cwd(), 'client/src/styles/games.css');

function readBundledCss() {
  return [
    fs.readFileSync(indexCssPath, 'utf8'),
    fs.readFileSync(coreCssPath, 'utf8'),
    fs.readFileSync(gamesCssPath, 'utf8'),
  ].join('\n');
}

describe('index.html refactor guardrails', () => {
  it('loads external stylesheet for staged CSS extraction', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.match(
      html,
      /<link\s+rel="stylesheet"\s+href="\/src\/styles\/index\.css"\s*\/?>/,
      'index.html should include the external stylesheet link',
    );
  });

  it('still loads main app entrypoint', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    assert.match(
      html,
      /<script\s+type="module"\s+src="\/src\/main\.js"><\/script>/,
      'index.html should keep the main Vite entry script',
    );
  });

  it('extracts base loading styles into external css (first slice)', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    const css = readBundledCss();

    assert.doesNotMatch(
      html,
      /#loading-screen\s*\{/,
      'loading screen styles should be removed from inline style block',
    );
    assert.match(
      css,
      /#loading-screen\s*\{/,
      'external stylesheet should contain loading screen styles',
    );
  });

  it('extracts lobby and room styles into external css (second slice)', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    const css = readBundledCss();

    assert.doesNotMatch(
      html,
      /\/\*\s*Lobby UI — scrollable so all game cards reach small viewports\s*\*\//,
      'lobby base section should be removed from inline style block',
    );
    assert.doesNotMatch(
      html,
      /\/\*\s*Room UI\s*\*\//,
      'room base section should be removed from inline style block',
    );
    assert.match(css, /\.lobby-ui\s*\{/, 'external stylesheet should contain lobby styles');
    assert.match(css, /\.room-section\s*\{/, 'external stylesheet should contain room styles');
  });

  it('fully removes inline style tag after final extraction', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    const css = readBundledCss();

    assert.doesNotMatch(html, /<style>/, 'index.html should not contain an inline style tag');
    assert.doesNotMatch(html, /<\/style>/, 'index.html should not contain an inline style closing tag');
    assert.match(css, /\.ca-layer\s*\{/, 'external stylesheet should include late-game style blocks');
  });

  it('keeps deterministic css import order after split', () => {
    const cssIndex = fs.readFileSync(indexCssPath, 'utf8');

    assert.match(cssIndex, /@import '\.\/core\.css';/, 'index.css should import core.css first');
    assert.match(cssIndex, /@import '\.\/games\.css';/, 'index.css should import games.css second');
  });
});
