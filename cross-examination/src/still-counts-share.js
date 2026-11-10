export const topicURL = (base, id) => { const url = new URL(base); url.search = ''; url.hash = ''; url.searchParams.set('topic', id); return url.href; };
export function receiptText(model, url) {
  return [`STILL COUNTS? · ${model.question}`,
    '', ...model.rows.map(r => `${r.label} ${r.verdictLabel}`),
    '', model.headline, '', url].join('\n');
}
export function wrapLines(ctx, text, width) {
  const lines = []; let line = '';
  for (const word of text.split(/\s+/)) {
    if (line && ctx.measureText(`${line} ${word}`).width > width) { lines.push(line); line = word; }
    else line += `${line ? ' ' : ''}${word}`;
  }
  if (line) lines.push(line);
  return lines;
}
export async function receiptPNG(model) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e8dfd1'; ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = '#fffdf6'; ctx.fillRect(54, 42, 972, 1250);
  ctx.fillStyle = '#202024'; ctx.font = '900 72px Arial'; ctx.fillText('STILL COUNTS?', 100, 142);
  ctx.font = '600 23px monospace'; ctx.fillText(`${model.day}${model.updated ? '  /  UPDATED' : ''}`, 104, 189);
  ctx.font = '700 37px Arial'; ctx.fillText(model.question, 104, 255);
  ctx.strokeStyle = '#202024'; ctx.setLineDash([8, 7]); ctx.beginPath(); ctx.moveTo(104, 326); ctx.lineTo(976, 326); ctx.stroke(); ctx.setLineDash([]);
  let y = 370;
  for (const row of model.rows) {
    ctx.fillStyle = row.verdict === 'yes' ? '#354ac0' : '#b33d15';
    ctx.font = '700 21px monospace'; ctx.fillText(row.verdictLabel, 106, y);
    ctx.fillStyle = '#202024'; ctx.font = '25px Arial';
    const lines = wrapLines(ctx, row.label, 845);
    lines.forEach((line, i) => ctx.fillText(line, 106, y + 30 + i * 28));
    y += 76;
  }
  y = Math.max(y + 12, 1030);
  ctx.fillStyle = '#f6dc7a'; ctx.fillRect(92, y - 28, 896, 164);
  ctx.fillStyle = '#202024'; ctx.font = 'bold 31px Arial';
  const headline = wrapLines(ctx, model.headline, 845);
  headline.forEach((line, i) => ctx.fillText(line, 112, y + 8 + i * 36));
  ctx.font = '21px monospace'; ctx.fillText('still counts?  /  Your line. Your call.', 104, 1261);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image export failed')), 'image/png'));
}
