const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const rows = JSON.parse(fs.readFileSync(path.join(root, 'audio/analysis/right-above-it-alignment.json'), 'utf8'));
const trackStart = 25.71;
const productLines = [];
for (const row of rows) {
  const words = (row.words || [])
    .filter(word => word.end > trackStart)
    .map(word => ({ ...word, text: word.text === 'boot' ? 'boo' : word.text }));
  let current = [];
  for (const word of words) {
    current.push({ ...word });
    const chars = current.reduce((sum, item) => sum + item.text.length, 0) + current.length - 1;
    const closesPhrase = /[,;:?!]$/.test(word.text);
    if (current.length >= 7 || chars >= 38 || (closesPhrase && current.length >= 4)) {
      productLines.push(current);
      current = [];
    }
  }
  if (current.length) productLines.push(current);
}

// Resolve tiny overlaps produced by forced alignment.
const flattenedWords = productLines.flat();
for (let index = 1; index < flattenedWords.length; index++) {
  const previous = flattenedWords[index - 1];
  const current = flattenedWords[index];
  if (current.start < previous.end) {
    const boundary = Math.max(previous.start, (current.start + previous.end) / 2);
    previous.end = boundary;
    current.start = boundary;
    current.end = Math.max(current.start, current.end);
  }
}

const stamp = value => {
  const centiseconds = Math.round(value * 100);
  return String(Math.floor(centiseconds / 6000)).padStart(2, '0') + ':' +
    String(Math.floor(centiseconds / 100) % 60).padStart(2, '0') + '.' +
    String(centiseconds % 100).padStart(2, '0');
};
const output = productLines.map(words =>
  `[${stamp(words[0].start)}] ` + words.map(word =>
    `<${stamp(word.start)}>${word.text}<${stamp(Math.max(word.start, word.end))}>`
  ).join(' ')
);
fs.writeFileSync(path.join(root, 'audio/lyrics/right-above-it.lrc'), output.join('\n') + '\n');
console.log(JSON.stringify({ lines: productLines.length, words: productLines.flat().length }));
