export const formatChatTime = (createdAt: string): string => new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
}).format(new Date(createdAt));
