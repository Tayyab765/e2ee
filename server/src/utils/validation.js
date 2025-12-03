export function requireFields(obj, fields) {
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null || obj[f] === '') {
      return `Missing field: ${f}`;
    }
  }
  return null;
}
