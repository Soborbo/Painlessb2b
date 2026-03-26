export const STATUS_CONFIG = {
  new: { label: 'New', color: '#3b82f6' },
  contacted: { label: 'Contacted', color: '#f59e0b' },
  follow_up: { label: 'Follow Up', color: '#f97316' },
  in_conversation: { label: 'In Conversation', color: '#8b5cf6' },
  partner: { label: 'Partner', color: '#10b981' },
  rejected: { label: 'Rejected', color: '#ef4444' },
  not_interested: { label: 'Not Interested', color: '#6b7280' },
} as const;

export type Status = keyof typeof STATUS_CONFIG;

export const STATUSES = Object.keys(STATUS_CONFIG) as Status[];

export const PRIORITY_CONFIG = {
  high: { label: 'High', color: '#ef4444' },
  medium: { label: 'Medium', color: '#f59e0b' },
  low: { label: 'Low', color: '#6b7280' },
} as const;

export type Priority = keyof typeof PRIORITY_CONFIG;

export const PRIORITIES = Object.keys(PRIORITY_CONFIG) as Priority[];

export const COOKIE_NAME = 'session';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
