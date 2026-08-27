import type { ReactNode } from "react";

export type OperationNavIconName =
  | "actions"
  | "approvals"
  | "audit"
  | "chat"
  | "music"
  | "overview"
  | "overlays"
  | "providers"
  | "rules"
  | "stream"
  | "users";

const iconPaths: Record<OperationNavIconName, ReactNode> = {
  actions: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8Z" />,
  approvals: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6m3-3h-6" /></>,
  audit: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 3v6h6" /><path d="M12 7v5l3 2" /></>,
  chat: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />,
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  overview: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
  overlays: <><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 14 9 5 9-5" /><path d="m3 19 9 5 9-5" /></>,
  providers: <><path d="M20 13a8 8 0 0 1-15.5 2.8" /><path d="M4 11a8 8 0 0 1 15.5-2.8" /><path d="M17 8h3V5" /><path d="M7 16H4v3" /></>,
  rules: <><path d="M6 2h9l5 5v15H6z" /><path d="M14 2v6h6" /><path d="M9 13h6" /><path d="M9 17h6" /></>,
  stream: <><path d="M4 7h16v10H4z" /><path d="m10 10 5 2-5 2v-4Z" /></>,
  users: <><circle cx="12" cy="8" r="4" /><path d="M4 22a8 8 0 0 1 16 0" /></>
};

export const OperationNavIcon = ({ name }: { name: OperationNavIconName }): ReactNode => (
  <svg aria-hidden="true" className="operation-nav-icon" fill="none" viewBox="0 0 24 24">
    <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
      {iconPaths[name]}
    </g>
  </svg>
);
