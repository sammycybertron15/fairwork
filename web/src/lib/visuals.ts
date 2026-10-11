/**
 * Deterministic SVG visual placeholders and curated asset helpers.
 * Adheres strictly to spec 8.4 tokens: #080A05 (ink), #A0C82F (lime), #AAA997 (stone), no gradients.
 */

export function createDeterministicSvgThumbnail(title: string, tag: string): string {
  // Deterministic pattern choice based on title hash
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  const variant = Math.abs(hash) % 3;

  let pattern = "";
  if (variant === 0) {
    // Vector / Geometric Grid
    pattern = `
      <line x1="40" y1="40" x2="360" y2="40" stroke="#AAA997" stroke-width="1" stroke-dasharray="4 4" />
      <line x1="40" y1="120" x2="360" y2="120" stroke="#AAA997" stroke-width="1" stroke-dasharray="4 4" />
      <line x1="40" y1="200" x2="360" y2="200" stroke="#AAA997" stroke-width="1" stroke-dasharray="4 4" />
      <rect x="80" y="60" width="80" height="80" stroke="#A0C82F" stroke-width="2" fill="none" />
      <circle cx="260" cy="100" r="45" stroke="#A0C82F" stroke-width="2" fill="none" />
      <line x1="160" y1="100" x2="215" y2="100" stroke="#A0C82F" stroke-width="2" />
    `;
  } else if (variant === 1) {
    // Frontend / Dashboard Architecture
    pattern = `
      <rect x="40" y="40" width="320" height="160" rx="4" stroke="#AAA997" stroke-width="1" fill="#080A05" />
      <line x1="40" y1="70" x2="360" y2="70" stroke="#AAA997" stroke-width="1" />
      <rect x="60" y="52" width="24" height="6" fill="#A0C82F" />
      <rect x="60" y="90" width="80" height="90" stroke="#AAA997" stroke-width="1" fill="none" />
      <rect x="160" y="90" width="180" height="40" stroke="#AAA997" stroke-width="1" fill="none" />
      <rect x="160" y="140" width="180" height="40" stroke="#A0C82F" stroke-width="1" fill="none" />
    `;
  } else {
    // 3D Isometric / Spatial Wireframe
    pattern = `
      <polygon points="200,50 300,105 200,160 100,105" stroke="#A0C82F" stroke-width="2" fill="none" />
      <polygon points="200,160 300,105 300,195 200,250" stroke="#AAA997" stroke-width="1" fill="none" />
      <polygon points="200,160 100,105 100,195 200,250" stroke="#AAA997" stroke-width="1" fill="none" />
      <circle cx="200" cy="105" r="4" fill="#A0C82F" />
    `;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" width="100%" height="100%">
    <rect width="400" height="250" fill="#080A05" />
    ${pattern}
    <text x="20" y="235" fill="#AAA997" font-family="monospace" font-size="11">${tag.toUpperCase()}</text>
  </svg>`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createDeterministicAvatar(name: string, _handle?: string): string {
  void _handle;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <rect width="100" height="100" rx="8" fill="#080A05" />
    <rect x="2" y="2" width="96" height="96" rx="6" stroke="#A0C82F" stroke-width="2" fill="none" />
    <text x="50" y="58" fill="#FAFAF2" font-family="sans-serif" font-weight="600" font-size="28" text-anchor="middle" dominant-baseline="middle">${initials}</text>
  </svg>`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
