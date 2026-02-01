// =============================================================================
// Shared Types for Email Kategorisierung System
// =============================================================================

import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const ProviderEnum = z.enum(['GMAIL', 'OUTLOOK', 'IMAP']);
export type Provider = z.infer<typeof ProviderEnum>;

export const ConnectionStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ERROR', 'NEEDS_REAUTH']);
export type ConnectionStatus = z.infer<typeof ConnectionStatusEnum>;

export const CategoryCodeEnum = z.enum([
  'INVOICE',
  'INQUIRY',
  'DOCUMENT_APPROVAL',
  'ORDER',
  'APPOINTMENT',
  'CUSTOMER',
  'LEAD',
  'SUPPORT',
  'NEWSLETTER',
  'PERSONAL',
  'TODO',
  'SPAM_SUSPECT',
  'REVIEW',
]);
export type CategoryCode = z.infer<typeof CategoryCodeEnum>;

export const RuleTypeEnum = z.enum(['KEYWORD', 'REGEX', 'SENDER', 'SUBJECT', 'COMBINED']);
export type RuleType = z.infer<typeof RuleTypeEnum>;

export const RuleFieldEnum = z.enum(['FROM', 'TO', 'SUBJECT', 'BODY', 'ANY']);
export type RuleField = z.infer<typeof RuleFieldEnum>;

export const LabelTypeEnum = z.enum(['LABEL', 'CATEGORY', 'FOLDER', 'FLAG']);
export type LabelType = z.infer<typeof LabelTypeEnum>;

// =============================================================================
// CLASSIFICATION RESULT
// =============================================================================

export const ClassificationResultSchema = z.object({
  category: CategoryCodeEnum,
  confidence: z.number().min(0).max(1),
  suggestedLabel: z.string(),
  rationaleShort: z.string().max(200),
  classifiedBy: z.enum(['rules', 'llm']),
  matchedRule: z.string().optional(),
});

export type ClassificationResult = z.infer<typeof ClassificationResultSchema>;

// =============================================================================
// EMAIL MESSAGE (Normalized)
// =============================================================================

export const EmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  provider: ProviderEnum,
  from: z.string(),
  to: z.array(z.string()),
  cc: z.array(z.string()).optional(),
  subject: z.string(),
  snippet: z.string().optional(),
  body: z.string().optional(),
  date: z.date(),
  labels: z.array(z.string()).optional(),
  isRead: z.boolean().optional(),
  hasAttachments: z.boolean().optional(),
});

export type EmailMessage = z.infer<typeof EmailMessageSchema>;

// =============================================================================
// PROVIDER CONFIGS
// =============================================================================

export const GmailConfigSchema = z.object({
  provider: z.literal('GMAIL'),
});

export const OutlookConfigSchema = z.object({
  provider: z.literal('OUTLOOK'),
  useFolders: z.boolean().default(false), // Use folders instead of categories
});

export const IMAPConfigSchema = z.object({
  provider: z.literal('IMAP'),
  host: z.string(),
  port: z.number().default(993),
  secure: z.boolean().default(true),
  useFolders: z.boolean().default(true), // IMAP uses folders by default
  folderPrefix: z.string().optional(), // e.g., "INBOX/" or "EmailCat/"
});

export type GmailConfig = z.infer<typeof GmailConfigSchema>;
export type OutlookConfig = z.infer<typeof OutlookConfigSchema>;
export type IMAPConfig = z.infer<typeof IMAPConfigSchema>;
export type ProviderConfig = GmailConfig | OutlookConfig | IMAPConfig;

// =============================================================================
// API SCHEMAS
// =============================================================================

// Connection Create
export const CreateConnectionSchema = z.object({
  provider: ProviderEnum,
  email: z.string().email(),
  displayName: z.string().optional(),
  settings: z.record(z.unknown()).optional(),
});

export type CreateConnectionInput = z.infer<typeof CreateConnectionSchema>;

// IMAP Credential Create
export const CreateIMAPCredentialSchema = z.object({
  host: z.string(),
  port: z.number().min(1).max(65535),
  secure: z.boolean(),
  username: z.string(),
  password: z.string(),
});

export type CreateIMAPCredentialInput = z.infer<typeof CreateIMAPCredentialSchema>;

// Category Create/Update
export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(50),
  internalCode: CategoryCodeEnum,
  description: z.string().max(200).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().optional(),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

// Rule Create/Update
export const CreateRuleSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1).max(100),
  type: RuleTypeEnum,
  field: RuleFieldEnum,
  pattern: z.string().min(1),
  caseSensitive: z.boolean().optional(),
  priority: z.number().int().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const UpdateRuleSchema = CreateRuleSchema.partial().omit({ categoryId: true });

export type CreateRuleInput = z.infer<typeof CreateRuleSchema>;
export type UpdateRuleInput = z.infer<typeof UpdateRuleSchema>;

// Label Mapping Create/Update
export const CreateLabelMappingSchema = z.object({
  categoryId: z.string(),
  connectionId: z.string(),
  providerLabel: z.string(),
  labelType: LabelTypeEnum,
  autoCreate: z.boolean().optional(),
});

export type CreateLabelMappingInput = z.infer<typeof CreateLabelMappingSchema>;

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// =============================================================================
// PROCESSING TYPES
// =============================================================================

export interface ProcessingResult {
  connectionId: string;
  messagesProcessed: number;
  messagesLabeled: number;
  messagesReview: number;
  errors: Array<{
    messageId: string;
    error: string;
  }>;
  duration: number;
}

export interface CronRunResult {
  startedAt: Date;
  completedAt: Date;
  connections: ProcessingResult[];
  totalProcessed: number;
  totalLabeled: number;
  totalReview: number;
  totalErrors: number;
}

// =============================================================================
// AUDIT LOG TYPES
// =============================================================================

export const AuditActionEnum = z.enum([
  'CONNECTION_CREATED',
  'CONNECTION_UPDATED',
  'CONNECTION_DELETED',
  'CONNECTION_ERROR',
  'CATEGORY_CREATED',
  'CATEGORY_UPDATED',
  'CATEGORY_DELETED',
  'RULE_CREATED',
  'RULE_UPDATED',
  'RULE_DELETED',
  'LABEL_MAPPING_CREATED',
  'LABEL_MAPPING_UPDATED',
  'EMAIL_CLASSIFIED',
  'EMAIL_LABELED',
  'EMAIL_REVIEWED',
  'CRON_RUN_STARTED',
  'CRON_RUN_COMPLETED',
  'CRON_RUN_FAILED',
  'USER_LOGIN',
  'USER_LOGOUT',
  'SETTINGS_CHANGED',
]);

export type AuditAction = z.infer<typeof AuditActionEnum>;

// =============================================================================
// LLM TYPES
// =============================================================================

export const LLMProviderEnum = z.enum(['openai', 'anthropic', 'none']);
export type LLMProvider = z.infer<typeof LLMProviderEnum>;

export interface LLMClassificationRequest {
  from: string;
  subject: string;
  snippet: string;
  categories: Array<{
    code: string;
    name: string;
    description?: string;
  }>;
}

export interface LLMClassificationResponse {
  category: CategoryCode;
  confidence: number;
  rationale: string;
}
