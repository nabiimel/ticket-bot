/** Minimal 16px stroke icons for the dashboard nav. */
const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Icon = {
  overview: (
    <svg {...base}>
      <path d="M3 12 12 3l9 9" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  tickets: (
    <svg {...base}>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" />
      <path d="M9 6v12" strokeDasharray="2 2" />
    </svg>
  ),
  general: (
    <svg {...base}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  ),
  categories: (
    <svg {...base}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  panels: (
    <svg {...base}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  ),
  messages: (
    <svg {...base}>
      <path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2z" />
    </svg>
  ),
  snippets: (
    <svg {...base}>
      <path d="M4 7h16M4 12h10M4 17h7" />
      <path d="m15 15 2 2 4-4" />
    </svg>
  ),
  blacklist: (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </svg>
  ),
  transcripts: (
    <svg {...base}>
      <path d="M14 3v5h5" />
      <path d="M8 3h6l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M9 13h6M9 17h6" />
    </svg>
  ),
  stats: (
    <svg {...base}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
  audit: (
    <svg {...base}>
      <path d="M3 3v6h6" />
      <path d="M3.5 9A9 9 0 1 1 6 19.7" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  bell: (
    <svg {...base}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  permissions: (
    <svg {...base}>
      <path d="M12 3 4 6v6c0 5 3.4 7.7 8 9 4.6-1.3 8-4 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  applications: (
    <svg {...base}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  ),
};
