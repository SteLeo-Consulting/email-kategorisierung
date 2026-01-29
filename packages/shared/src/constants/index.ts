// =============================================================================
// Constants for Email Kategorisierung System
// =============================================================================

import type { CategoryCode } from '../types';

// =============================================================================
// DEFAULT CATEGORIES
// =============================================================================

export interface DefaultCategory {
  code: CategoryCode;
  name: string;
  description: string;
  color: string;
  icon: string;
  isSystem: boolean;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    code: 'INVOICE',
    name: 'Rechnung',
    description: 'Rechnungen, Zahlungsaufforderungen, Quittungen',
    color: '#ef4444', // red
    icon: 'receipt',
    isSystem: true,
  },
  {
    code: 'APPOINTMENT',
    name: 'Termin',
    description: 'Terminbestätigungen, Einladungen, Kalenderereignisse',
    color: '#f97316', // orange
    icon: 'calendar',
    isSystem: true,
  },
  {
    code: 'CUSTOMER',
    name: 'Kunde',
    description: 'Nachrichten von bestehenden Kunden',
    color: '#22c55e', // green
    icon: 'user-check',
    isSystem: true,
  },
  {
    code: 'LEAD',
    name: 'Lead',
    description: 'Potenzielle Kunden, Anfragen, Vertrieb',
    color: '#3b82f6', // blue
    icon: 'user-plus',
    isSystem: true,
  },
  {
    code: 'SUPPORT',
    name: 'Support',
    description: 'Support-Anfragen, Tickets, Hilfe-Anfragen',
    color: '#a855f7', // purple
    icon: 'headphones',
    isSystem: true,
  },
  {
    code: 'NEWSLETTER',
    name: 'Newsletter',
    description: 'Newsletter, Marketing-E-Mails, Abonnements',
    color: '#6366f1', // indigo
    icon: 'mail',
    isSystem: true,
  },
  {
    code: 'PERSONAL',
    name: 'Privat',
    description: 'Persönliche E-Mails, Freunde, Familie',
    color: '#ec4899', // pink
    icon: 'heart',
    isSystem: true,
  },
  {
    code: 'TODO',
    name: 'ToDo',
    description: 'Aufgaben, Action Items, Handlungsbedarf',
    color: '#eab308', // yellow
    icon: 'check-square',
    isSystem: true,
  },
  {
    code: 'SPAM_SUSPECT',
    name: 'Spam-Verdacht',
    description: 'Verdächtige E-Mails, potentieller Spam',
    color: '#64748b', // slate
    icon: 'alert-triangle',
    isSystem: true,
  },
  {
    code: 'REVIEW',
    name: 'Prüfen',
    description: 'Unsichere Klassifizierung, manuelle Prüfung erforderlich',
    color: '#f59e0b', // amber
    icon: 'eye',
    isSystem: true,
  },
];

// =============================================================================
// DEFAULT RULES (Keyword-based)
// =============================================================================

export interface DefaultRule {
  categoryCode: CategoryCode;
  name: string;
  type: 'KEYWORD' | 'REGEX' | 'SENDER';
  field: 'FROM' | 'SUBJECT' | 'BODY' | 'ANY';
  pattern: string;
  priority: number;
  confidence: number;
}

export const DEFAULT_RULES: DefaultRule[] = [
  // INVOICE rules
  {
    categoryCode: 'INVOICE',
    name: 'Rechnung im Betreff',
    type: 'KEYWORD',
    field: 'SUBJECT',
    pattern: 'rechnung',
    priority: 100,
    confidence: 0.90,
  },
  {
    categoryCode: 'INVOICE',
    name: 'Invoice in Subject',
    type: 'KEYWORD',
    field: 'SUBJECT',
    pattern: 'invoice',
    priority: 100,
    confidence: 0.90,
  },
  {
    categoryCode: 'INVOICE',
    name: 'Zahlungsaufforderung',
    type: 'KEYWORD',
    field: 'SUBJECT',
    pattern: 'zahlungsaufforderung',
    priority: 95,
    confidence: 0.85,
  },
  {
    categoryCode: 'INVOICE',
    name: 'Quittung/Receipt',
    type: 'REGEX',
    field: 'SUBJECT',
    pattern: '(quittung|receipt|beleg)',
    priority: 90,
    confidence: 0.85,
  },

  // APPOINTMENT rules
  {
    categoryCode: 'APPOINTMENT',
    name: 'Terminbestätigung',
    type: 'KEYWORD',
    field: 'SUBJECT',
    pattern: 'terminbestätigung',
    priority: 100,
    confidence: 0.90,
  },
  {
    categoryCode: 'APPOINTMENT',
    name: 'Meeting Invitation',
    type: 'REGEX',
    field: 'SUBJECT',
    pattern: '(meeting|besprechung|termin).*(einladung|invitation)',
    priority: 95,
    confidence: 0.85,
  },
  {
    categoryCode: 'APPOINTMENT',
    name: 'Calendar Event',
    type: 'KEYWORD',
    field: 'SUBJECT',
    pattern: 'calendar event',
    priority: 90,
    confidence: 0.85,
  },

  // NEWSLETTER rules
  {
    categoryCode: 'NEWSLETTER',
    name: 'Newsletter im Betreff',
    type: 'KEYWORD',
    field: 'SUBJECT',
    pattern: 'newsletter',
    priority: 100,
    confidence: 0.95,
  },
  {
    categoryCode: 'NEWSLETTER',
    name: 'Abbestellen Link',
    type: 'REGEX',
    field: 'BODY',
    pattern: '(abmelden|unsubscribe|abbestellen)',
    priority: 80,
    confidence: 0.75,
  },
  {
    categoryCode: 'NEWSLETTER',
    name: 'Noreply Sender',
    type: 'REGEX',
    field: 'FROM',
    pattern: '(noreply|no-reply|newsletter)@',
    priority: 70,
    confidence: 0.70,
  },

  // SUPPORT rules
  {
    categoryCode: 'SUPPORT',
    name: 'Support Ticket',
    type: 'REGEX',
    field: 'SUBJECT',
    pattern: '(ticket|support|hilfe|help).*(#|nr|nummer)',
    priority: 100,
    confidence: 0.90,
  },
  {
    categoryCode: 'SUPPORT',
    name: 'Support Sender',
    type: 'REGEX',
    field: 'FROM',
    pattern: '(support|helpdesk|service)@',
    priority: 85,
    confidence: 0.80,
  },

  // TODO rules
  {
    categoryCode: 'TODO',
    name: 'Action Required',
    type: 'REGEX',
    field: 'SUBJECT',
    pattern: '(action required|handlungsbedarf|dringend)',
    priority: 100,
    confidence: 0.85,
  },
  {
    categoryCode: 'TODO',
    name: 'Please Review',
    type: 'REGEX',
    field: 'SUBJECT',
    pattern: '(bitte prüfen|please review|zur durchsicht)',
    priority: 90,
    confidence: 0.80,
  },

  // SPAM_SUSPECT rules
  {
    categoryCode: 'SPAM_SUSPECT',
    name: 'Lottery/Prize',
    type: 'REGEX',
    field: 'SUBJECT',
    pattern: '(lottery|gewinn|prize|congratulations.*won)',
    priority: 100,
    confidence: 0.90,
  },
  {
    categoryCode: 'SPAM_SUSPECT',
    name: 'Urgent Money',
    type: 'REGEX',
    field: 'SUBJECT',
    pattern: '(urgent.*transfer|dringend.*überweisung|inheritance)',
    priority: 95,
    confidence: 0.85,
  },
];

// =============================================================================
// PROVIDER CONSTANTS
// =============================================================================

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.modify',
];

export const OUTLOOK_SCOPES = [
  'offline_access',
  'Mail.Read',
  'Mail.ReadWrite',
  'MailboxSettings.Read',
];

export const STRATO_IMAP_CONFIG = {
  host: 'imap.strato.de',
  port: 993,
  secure: true,
};

// =============================================================================
// CLASSIFICATION THRESHOLDS
// =============================================================================

export const CLASSIFICATION_THRESHOLDS = {
  HIGH_CONFIDENCE: 0.80,
  MEDIUM_CONFIDENCE: 0.60,
  LOW_CONFIDENCE: 0.40,
};

// Label assignment rules:
// - confidence >= 0.80: Apply final category label
// - confidence 0.60-0.79: Apply REVIEW label + log suggested category
// - confidence < 0.60: Apply REVIEW label only

// =============================================================================
// PROCESSING LIMITS
// =============================================================================

export const PROCESSING_LIMITS = {
  MAX_EMAILS_PER_RUN: 50,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  TOKEN_REFRESH_BUFFER_MINUTES: 5,
};

// =============================================================================
// DEFAULT LABEL NAMES
// =============================================================================

export const DEFAULT_LABEL_NAMES: Record<CategoryCode, string> = {
  INVOICE: 'EmailCat/Rechnung',
  APPOINTMENT: 'EmailCat/Termin',
  CUSTOMER: 'EmailCat/Kunde',
  LEAD: 'EmailCat/Lead',
  SUPPORT: 'EmailCat/Support',
  NEWSLETTER: 'EmailCat/Newsletter',
  PERSONAL: 'EmailCat/Privat',
  TODO: 'EmailCat/ToDo',
  SPAM_SUSPECT: 'EmailCat/Spam-Verdacht',
  REVIEW: 'EmailCat/Prüfen',
};
