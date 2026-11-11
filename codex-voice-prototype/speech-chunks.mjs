// Keep the exact answer text, but allow the first sentence to play sooner.
export function speechChunks(text, mode = 'whole') {
  if (mode !== 'sentences') return text.match(/[\s\S]{1,3000}/g) || [];
  const chunks = [];
  let rest = text;
  while (rest.length) {
    const max = chunks.length ? 600 : 240;
    const window = rest.slice(0, max);
    const matches = [...window.matchAll(/[.!?](?:\s+|$)/g)];
    const sentence = chunks.length ? matches.at(-1) : matches[0];
    let end = sentence ? sentence.index + sentence[0].length : window.length;
    if (!sentence && rest.length > max) {
      const boundary = window.lastIndexOf(' ');
      if (boundary > max / 2) end = boundary + 1;
    }
    chunks.push(rest.slice(0, end)); rest = rest.slice(end);
  }
  return chunks;
}
