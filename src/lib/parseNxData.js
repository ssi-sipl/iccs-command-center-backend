function normalizeType(rawType = "") {
  if (!rawType) return "Object";

  // take last segment if dot-separated
  const clean = rawType.includes(".") ? rawType.split(".").pop() : rawType;

  // capitalize properly
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function formatHumanTime(timestampUs) {
  if (!timestampUs) return null;

  const date = new Date(timestampUs / 1000);

  return date.toLocaleString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function parseNxData(dataStr = "") {
  const result = {};

  for (const pair of dataStr.split(";")) {
    if (!pair) continue;
    const [key, value] = pair.split(":", 2);
    result[key] = value;
  }

  const timestampUs = Number(result.TimestampUs || 0);
  const type = normalizeType(result.Type);

  return {
    type,
    message: `${type || "Object"} detected`,
    confidence: Number(result.Confidence || 0),
    timestamp: new Date(timestampUs / 1000).toISOString(),
    time: formatHumanTime(timestampUs),
  };
}

export default parseNxData;
