const pdfParse = require('pdf-parse');

const CHUNK_SIZE = 500;
const MAX_CHUNKS = 20;

const MAX_PAGES = 25;

async function extractText(buffer) {
  const data = await pdfParse(buffer, { max: MAX_PAGES });
  const text = data.text.trim();
  if (!text) throw new Error('PDF contains no extractable text');
  return {
    text,
    pageCount: data.numpages,
    truncated: data.numpages > MAX_PAGES,
  };
}

function chunkText(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length && chunks.length < MAX_CHUNKS; i += CHUNK_SIZE) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(' '));
  }
  return chunks;
}

module.exports = { extractText, chunkText };
