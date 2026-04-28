/**
 * Parse CSV text into an array of row objects.
 * Handles quoted fields (commas inside quotes, escaped quotes).
 */

function parseLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values;
}

export function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseLine(line);
    /* Skip totally empty rows (all values blank) */
    if (values.every((v) => !v.trim())) continue;

    const row = {};
    headers.forEach((h, idx) => {
      const key = h.trim();
      if (key) row[key] = (values[idx] || "").trim();
    });
    rows.push(row);
  }

  return rows;
}
