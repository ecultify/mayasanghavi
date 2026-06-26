// Shared types for the Meta WhatsApp Cloud API surface we use.

export type TemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED"
  | "IN_APPEAL"
  | string;

export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION" | string;

export type HeaderType = "NONE" | "TEXT" | "IMAGE";

export interface TemplateButton {
  type: "QUICK_REPLY" | "URL";
  text: string;
  url?: string; // for URL buttons
}

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  example?: {
    header_text?: string[];
    header_handle?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
  }>;
}

export interface MetaTemplate {
  id?: string;
  name: string;
  status: TemplateStatus;
  category: TemplateCategory;
  language: string;
  components: TemplateComponent[];
  rejected_reason?: string;
  quality_score?: { score?: string; date?: number };
}

// Normalized shape the dashboard consumes (detected variable + header info).
export interface NormalizedTemplate {
  id?: string;
  name: string;
  status: TemplateStatus;
  category: TemplateCategory;
  language: string;
  hasNameVar: boolean;
  hasHeaderImage: boolean;
  headerType: HeaderType;
  bodyText: string;
  footerText: string | null;
  buttons: TemplateButton[];
  rejectedReason: string | null;
  // Meta returns UNKNOWN/NONE until the template has been delivered enough.
  qualityScore: string | null;
}

export interface WabaHealth {
  qualityRating: string | null;
  messagingLimitTier: string | null;
  verifiedName: string | null;
  displayPhoneNumber: string | null;
  codeVerificationStatus: string | null;
}

export interface SendResult {
  ok: boolean;
  messageId: string | null;
  errorCode: string | null;
  errorDetail: string | null;
}

export interface CreateTemplateInput {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY";
  headerType: HeaderType;
  headerText?: string;
  headerImageHandle?: string; // media handle from resumable upload
  body: string;
  bodyExample?: string; // sample for {{1}} when body has a variable
  footer?: string;
  buttons?: TemplateButton[];
}
