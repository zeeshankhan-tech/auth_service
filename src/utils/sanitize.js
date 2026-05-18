/**
 * Trims strings and strips null bytes to reduce odd injection vectors on stored strings.
 */
function sanitizeString(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\0/g, '').trim();
}

function sanitizeObjectStrings(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const key of Object.keys(out)) {
    if (typeof out[key] === 'string') {
      out[key] = sanitizeString(out[key]);
    }
  }
  return out;
}

module.exports = { sanitizeString, sanitizeObjectStrings };
