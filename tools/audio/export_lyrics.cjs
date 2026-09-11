const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const rows = JSON.parse(fs.readFileSync(path.join(root, 'audio/analysis/kleopatri-alignment.json'), 'utf8'));
const stamp = time => {
  const cs = Math.round(time * 100);
  return String(Math.floor(cs / 6000)).padStart(2, '0') + ':' +
    String(Math.floor(cs / 100) % 60).padStart(2, '0') + '.' + String(cs % 100).padStart(2, '0');
};
let previous = 0;
let wordCount = 0;
let uncertain = 0;
const output = rows.map((row, index) => {
  if (!row.words?.length) return '[' + stamp(row.time) + ']';
  const next = rows[index + 1];
  const boundary = next?.words?.[0]?.start ?? next?.time ?? row.end;
  const words = row.words.map(word => {
    // Preserve uncertain instantaneous model boundaries rather than inventing durations.
    const start = Math.max(previous, Math.min(word.start, boundary));
    const end = Math.max(start, Math.min(word.end, boundary));
    previous = end;
    wordCount++;
    if (end - start < .04) uncertain++;
    return { ...word, start, end };
  });
  return '[' + stamp(words[0].start) + '] ' + words.map(word =>
    '<' + stamp(word.start) + '>' + word.text + '<' + stamp(word.end) + '>'
  ).join(' ');
});
fs.writeFileSync(path.join(root, 'audio/lyrics/kleopatri.lrc'), output.join('\n') + '\n');
console.log(JSON.stringify({ rows: rows.length, wordCount, uncertain }));
