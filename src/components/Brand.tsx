/**
 * Product mark. Inline SVG so it scales cleanly and costs nothing to load.
 * A grid with one cell being filled in, which is what the product does.
 */
export function Brand({
  size = 28,
  title = "Spreadsheet Agent",
}: {
  size?: number;
  title?: string;
}) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      focusable="false"
    >
      <rect x="2" y="2" width="28" height="28" rx="7" fill="var(--green-600)" />
      <g stroke="var(--green-100)" strokeWidth="1.5" strokeLinecap="round" opacity="0.65">
        <path d="M9 11h14M9 16h14M9 21h14" />
        <path d="M14.5 8v16M21 8v16" />
      </g>
      <rect x="14.5" y="16" width="6.5" height="5" fill="var(--green-50)" rx="1" />
      <circle cx="23.5" cy="9.5" r="3.4" fill="var(--amber-500)" />
    </svg>
  );
}
