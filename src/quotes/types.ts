export const QUOTE_STATUSES = [
  'draft',
  'sent',
  'opened',
  'clicked',
  'replied',
  'won',
  'lost',
  'expired',
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_EVENT_TYPES = [
  'created',
  'edited',
  'sent',
  'opened',
  'clicked',
  'replied',
  'status_changed',
  'bounced',
  'complained',
  'reset',
] as const;

export type QuoteEventType = (typeof QUOTE_EVENT_TYPES)[number];

export const SENDER_ALIASES = ['jay', 'richard', 'quotes', 'hello'] as const;
export type SenderAlias = (typeof SENDER_ALIASES)[number];

export interface QuoteRow {
  id: string;
  template_id: string;
  company_id: string | null;
  contact_id: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  sender_alias: SenderAlias | null;
  subject: string | null;
  message_body: string | null;
  field_data: string;
  status: QuoteStatus;
  deal_value_pence: number | null;
  pdf_r2_key: string | null;
  resend_message_id: string | null;
  tracking_token: string | null;
  tracking_enabled: 0 | 1;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  first_opened_at: string | null;
  last_activity_at: string | null;
}

export interface Quote extends Omit<QuoteRow, 'field_data' | 'tracking_enabled'> {
  field_data: Record<string, string>;
  tracking_enabled: boolean;
}

export interface QuoteEventRow {
  id: string;
  quote_id: string;
  event_type: QuoteEventType;
  payload: string | null;
  occurred_at: string;
}

export interface QuoteEvent extends Omit<QuoteEventRow, 'payload'> {
  payload: Record<string, unknown> | null;
}

export interface TemplateFieldDef {
  id: string;
  label: string;
  group: string;
  type: 'text' | 'textarea';
  default: string;
  required?: boolean;
}

export interface TemplateMeta {
  id: string;
  name: string;
  default_subject: string;
  default_body: string;
  fields: TemplateFieldDef[];
}

export interface TemplateSummary {
  id: string;
  name: string;
  field_count: number;
}

export function rowToQuote(row: QuoteRow): Quote {
  let fieldData: Record<string, string> = {};
  try {
    const parsed = JSON.parse(row.field_data || '{}');
    if (parsed && typeof parsed === 'object') {
      fieldData = parsed as Record<string, string>;
    }
  } catch {
    fieldData = {};
  }
  return {
    ...row,
    field_data: fieldData,
    tracking_enabled: row.tracking_enabled === 1,
  };
}

export function rowToEvent(row: QuoteEventRow): QuoteEvent {
  let payload: Record<string, unknown> | null = null;
  if (row.payload) {
    try {
      const parsed = JSON.parse(row.payload);
      if (parsed && typeof parsed === 'object') {
        payload = parsed as Record<string, unknown>;
      }
    } catch {
      payload = null;
    }
  }
  return { ...row, payload };
}
