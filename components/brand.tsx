import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="AI Tathastu, home">
      <span className="brand-mark" aria-hidden="true" style={{ width: 36, height: 36, flex: "none", display: "inline-grid", placeItems: "center" }}>
        <svg width="36" height="36" viewBox="0 0 52 52" fill="none" style={{ width: 36, height: 36, display: "block" }}>
          <path d="M25.5 2.5c2.4 12.7 4.8 16 17.2 18.2-12.4 2.2-14.8 5.6-17.2 18.1C23.1 26.3 20.7 22.9 8.3 20.7 20.7 18.5 23.1 15.2 25.5 2.5Z" fill="url(#brand-gradient)"/>
          <path d="M10.5 33.5c1 5.6 2.2 7.1 7.6 8.1-5.4 1-6.6 2.5-7.6 8.1-1-5.6-2.2-7.1-7.6-8.1 5.4-1 6.6-2.5 7.6-8.1Z" fill="#5642EF"/>
          <path d="M42.5 1.5c.6 3.3 1.3 4.2 4.5 4.8-3.2.6-3.9 1.5-4.5 4.8-.6-3.3-1.3-4.2-4.5-4.8 3.2-.6 3.9-1.5 4.5-4.8Z" fill="#F5AA23"/>
          <defs>
            <linearGradient id="brand-gradient" x1="7" y1="3" x2="46" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#9B55FF"/>
              <stop offset=".55" stopColor="#6340EE"/>
              <stop offset="1" stopColor="#286CF6"/>
            </linearGradient>
          </defs>
        </svg>
      </span>
      <span className="brand-text">AI Tathastu{!compact && <small>You imagine. AI makes it happen.</small>}</span>
    </Link>
  );
}
