interface TemplateParams {
  companyName: string;
  contactName: string;
  clientName?: string;
}

interface EmailTemplate {
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATES = {
  intro: {
    label: 'Intro Email',
    generate: ({ companyName, contactName, clientName = 'our client' }: TemplateParams): EmailTemplate => ({
      subject: `Referral Partnership Opportunity — ${clientName}`,
      body: `Hi ${contactName || 'there'},

I hope this email finds you well. My name is Laszlo, and I run a marketing consultancy that works with service businesses in the Bristol area.

I'm reaching out because we work with ${clientName}, a well-established removal company, and we're building a network of trusted referral partners — solicitors, estate agents, and other professionals who interact with people during the moving process.

The idea is simple: when your clients are moving home and need a reliable removal service, you'd have a trusted name to recommend. In return, we'd love to explore how we can send business your way too.

Would you be open to a quick 10-minute call to discuss whether this could work for both of us?

Best regards,
Laszlo`,
    }),
  },
  follow_up: {
    label: 'Follow-Up Email',
    generate: ({ companyName, contactName }: TemplateParams): EmailTemplate => ({
      subject: `Following up — Referral Partnership`,
      body: `Hi ${contactName || 'there'},

I wanted to follow up on my previous email about a potential referral partnership.

I understand you're busy, so I'll keep this brief — we've had great success with similar partnerships in the Bristol area, and I think ${companyName} would be a fantastic fit.

Would you have 10 minutes this week for a quick call? Happy to work around your schedule.

Best regards,
Laszlo`,
    }),
  },
  partnership: {
    label: 'Partnership Proposal',
    generate: ({ companyName, contactName, clientName = 'our client' }: TemplateParams): EmailTemplate => ({
      subject: `Partnership Proposal — ${companyName} × ${clientName}`,
      body: `Hi ${contactName || 'there'},

Thank you for your interest in exploring a referral partnership. I wanted to share a bit more detail on how this would work:

**What we're proposing:**
- When your clients at ${companyName} are moving home and need removal services, you recommend ${clientName} as a trusted partner
- In return, when ${clientName}'s customers need your services, we recommend ${companyName}
- We can provide branded referral cards, a dedicated landing page, or whatever format works best for your team

**Why this works:**
- Your clients get a trusted recommendation during a stressful time
- You build goodwill without any cost or effort
- Both businesses grow through genuine, quality referrals

I'd love to set up a short meeting to discuss the details and tailor this to what works for ${companyName}.

Best regards,
Laszlo`,
    }),
  },
} as const;

export type TemplateName = keyof typeof EMAIL_TEMPLATES;
export const TEMPLATE_NAMES = Object.keys(EMAIL_TEMPLATES) as TemplateName[];
