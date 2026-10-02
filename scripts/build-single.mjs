// vite build 결과(dist/)를 JS·CSS 가 인라인된 단일 HTML 로 묶는다.
//   node scripts/build-single.mjs                 → dist/boom-room-single.html (더블클릭으로 열 수 있는 단일 파일)
//   node scripts/build-single.mjs --fragment out  → <html>/<head>/<body> 태그 없는 본문 조각 (웹 호스팅 래퍼용)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');

const jsMatch = html.match(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/);
const cssMatch = html.match(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/);
if (!jsMatch || !cssMatch) throw new Error('dist/index.html 에서 번들 파일을 찾지 못했습니다. 먼저 npm run build 를 실행하세요.');

const js = readFileSync(join(dist, jsMatch[1]), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(join(dist, cssMatch[1]), 'utf8');

// 치환 문자열 안의 $&, $' 등이 특수 패턴으로 해석되지 않도록 함수형 치환 사용
html = html.replace(jsMatch[0], () => '').replace(cssMatch[0], () => `<style>${css}</style>`);
html = html.replace('</body>', () => `<script type="module">${js}</script>\n  </body>`);

const fragIdx = process.argv.indexOf('--fragment');
if (fragIdx >= 0) {
  const out = process.argv[fragIdx + 1];
  const frag = html
    .replace(/<!doctype html>/i, '')
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?head>/gi, '')
    .replace(/<\/?body>/gi, '')
    .replace(/<meta charset="utf-8" \/>/i, '')
    .replace(/<meta name="viewport"[^>]*\/>/i, '')
    .trim();
  writeFileSync(out, frag);
  console.log(`fragment → ${out} (${(frag.length / 1024).toFixed(0)} KB)`);
} else {
  const out = join(dist, 'boom-room-single.html');
  writeFileSync(out, html);
  console.log(`single file → ${out} (${(html.length / 1024).toFixed(0)} KB)`);
}
