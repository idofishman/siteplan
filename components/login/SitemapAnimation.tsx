// Animated horizontal sitemap illustration for the login page.
// Pure SVG + CSS — no runtime JS after mount.
export function SitemapAnimation() {
  return (
    <div className="w-full h-full flex items-center justify-center p-6 select-none" aria-hidden>
      <svg
        viewBox="0 0 560 330"
        className="w-full max-w-lg"
        style={{ overflow: 'visible' }}
      >
        <style>{`
          @keyframes sm-node {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes sm-line {
            from { stroke-dashoffset: 1; }
            to   { stroke-dashoffset: 0; }
          }
          .sm-connector {
            fill: none;
            stroke: #94A3B8;
            stroke-width: 1.5;
            pathLength: 1;
            stroke-dasharray: 1;
            stroke-dashoffset: 1;
          }
          /* level 0 */
          .sm-n0  { animation: sm-node 0.3s ease forwards 0.15s; opacity: 0; }
          /* connectors to level 1 */
          .sm-l01 { animation: sm-line 0.3s ease-out forwards 0.45s; }
          .sm-l02 { animation: sm-line 0.3s ease-out forwards 0.55s; }
          .sm-l03 { animation: sm-line 0.3s ease-out forwards 0.65s; }
          /* level 1 nodes */
          .sm-n1  { animation: sm-node 0.3s ease forwards 0.50s; opacity: 0; }
          .sm-n2  { animation: sm-node 0.3s ease forwards 0.60s; opacity: 0; }
          .sm-n3  { animation: sm-node 0.3s ease forwards 0.70s; opacity: 0; }
          /* connectors to level 2 */
          .sm-l14 { animation: sm-line 0.3s ease-out forwards 0.95s; }
          .sm-l15 { animation: sm-line 0.3s ease-out forwards 1.05s; }
          .sm-l26 { animation: sm-line 0.3s ease-out forwards 1.00s; }
          .sm-l27 { animation: sm-line 0.3s ease-out forwards 1.10s; }
          .sm-l38 { animation: sm-line 0.3s ease-out forwards 1.05s; }
          .sm-l39 { animation: sm-line 0.3s ease-out forwards 1.15s; }
          /* level 2 nodes */
          .sm-n4  { animation: sm-node 0.3s ease forwards 1.00s; opacity: 0; }
          .sm-n5  { animation: sm-node 0.3s ease forwards 1.10s; opacity: 0; }
          .sm-n6  { animation: sm-node 0.3s ease forwards 1.05s; opacity: 0; }
          .sm-n7  { animation: sm-node 0.3s ease forwards 1.15s; opacity: 0; }
          .sm-n8  { animation: sm-node 0.3s ease forwards 1.10s; opacity: 0; }
          .sm-n9  { animation: sm-node 0.3s ease forwards 1.20s; opacity: 0; }
          /* connectors to level 3 */
          .sm-l4a { animation: sm-line 0.3s ease-out forwards 1.50s; }
          .sm-l5b { animation: sm-line 0.3s ease-out forwards 1.60s; }
          .sm-l7c { animation: sm-line 0.3s ease-out forwards 1.55s; }
          .sm-l9d { animation: sm-line 0.3s ease-out forwards 1.65s; }
          /* level 3 nodes */
          .sm-na  { animation: sm-node 0.3s ease forwards 1.55s; opacity: 0; }
          .sm-nb  { animation: sm-node 0.3s ease forwards 1.65s; opacity: 0; }
          .sm-nc  { animation: sm-node 0.3s ease forwards 1.60s; opacity: 0; }
          .sm-nd  { animation: sm-node 0.3s ease forwards 1.70s; opacity: 0; }
        `}</style>

        {/* ── Connector lines ─────────────────────────────────────── */}

        {/* Root → L1 */}
        <path className="sm-connector sm-l01" pathLength="1" d="M 280,43 L 100,107" />
        <path className="sm-connector sm-l02" pathLength="1" d="M 280,43 L 280,107" />
        <path className="sm-connector sm-l03" pathLength="1" d="M 280,43 L 460,107" />

        {/* L1 → L2 */}
        <path className="sm-connector sm-l14" pathLength="1" d="M 100,123 L 45,177" />
        <path className="sm-connector sm-l15" pathLength="1" d="M 100,123 L 155,177" />
        <path className="sm-connector sm-l26" pathLength="1" d="M 280,123 L 225,177" />
        <path className="sm-connector sm-l27" pathLength="1" d="M 280,123 L 335,177" />
        <path className="sm-connector sm-l38" pathLength="1" d="M 460,123 L 415,177" />
        <path className="sm-connector sm-l39" pathLength="1" d="M 460,123 L 515,177" />

        {/* L2 → L3 */}
        <path className="sm-connector sm-l4a" pathLength="1" d="M 45,193 L 45,247" />
        <path className="sm-connector sm-l5b" pathLength="1" d="M 155,193 L 155,247" />
        <path className="sm-connector sm-l7c" pathLength="1" d="M 335,193 L 335,247" />
        <path className="sm-connector sm-l9d" pathLength="1" d="M 515,193 L 480,247" />

        {/* ── Nodes ───────────────────────────────────────────────── */}

        {/* Level 0 — Root */}
        <g className="sm-n0">
          <rect x="241" y="17" width="78" height="26" rx="5" fill="#2563EB" />
          <text x="280" y="33" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">דף הבית</text>
        </g>

        {/* Level 1 */}
        <g className="sm-n1">
          <rect x="61" y="107" width="78" height="26" rx="5" fill="#4F46E5" />
          <text x="100" y="123" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">מוצרים</text>
        </g>
        <g className="sm-n2">
          <rect x="241" y="107" width="78" height="26" rx="5" fill="#4F46E5" />
          <text x="280" y="123" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">אודות</text>
        </g>
        <g className="sm-n3">
          <rect x="421" y="107" width="78" height="26" rx="5" fill="#4F46E5" />
          <text x="460" y="123" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">שירותים</text>
        </g>

        {/* Level 2 */}
        <g className="sm-n4">
          <rect x="6" y="177" width="78" height="26" rx="5" fill="#0891B2" />
          <text x="45" y="193" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">קטלוג</text>
        </g>
        <g className="sm-n5">
          <rect x="116" y="177" width="78" height="26" rx="5" fill="#0891B2" />
          <text x="155" y="193" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">מחירים</text>
        </g>
        <g className="sm-n6">
          <rect x="186" y="177" width="78" height="26" rx="5" fill="#0891B2" />
          <text x="225" y="193" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">צוות</text>
        </g>
        <g className="sm-n7">
          <rect x="296" y="177" width="78" height="26" rx="5" fill="#0891B2" />
          <text x="335" y="193" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">ערכינו</text>
        </g>
        <g className="sm-n8">
          <rect x="376" y="177" width="78" height="26" rx="5" fill="#0891B2" />
          <text x="415" y="193" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">פרויקטים</text>
        </g>
        <g className="sm-n9">
          <rect x="476" y="177" width="78" height="26" rx="5" fill="#0891B2" />
          <text x="515" y="193" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">פתרונות</text>
        </g>

        {/* Level 3 */}
        <g className="sm-na">
          <rect x="6" y="247" width="78" height="26" rx="5" fill="#059669" />
          <text x="45" y="263" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">מוצר א׳</text>
        </g>
        <g className="sm-nb">
          <rect x="116" y="247" width="78" height="26" rx="5" fill="#059669" />
          <text x="155" y="263" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">מוצר ב׳</text>
        </g>
        <g className="sm-nc">
          <rect x="296" y="247" width="78" height="26" rx="5" fill="#059669" />
          <text x="335" y="263" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">יצירת קשר</text>
        </g>
        <g className="sm-nd">
          <rect x="441" y="247" width="78" height="26" rx="5" fill="#059669" />
          <text x="480" y="263" textAnchor="middle" fill="white" fontSize="9" fontFamily="system-ui, sans-serif">תיק עבודות</text>
        </g>
      </svg>
    </div>
  )
}
