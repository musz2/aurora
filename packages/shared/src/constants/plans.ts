export type PlanId = "BASIC" | "PRO" | "BUSINESS" | "ENTERPRISE";

export interface PlanLimits {
  id: PlanId;
  name: string;
  priceMonthly: number | null; // null => custom
  priceAnnual: number | null;
  monthlyMinutes: number; // -1 => unlimited / custom
  maxMinutesPerConversation: number; // -1 => unlimited
  lifetimeImports: number; // -1 => unlimited
  seats: number; // -1 => custom
  tagline: string;
  features: string[];
  highlighted?: boolean;
}

export const PLANS: Record<PlanId, PlanLimits> = {
  BASIC: {
    id: "BASIC",
    name: "Basic",
    priceMonthly: 0,
    priceAnnual: 0,
    monthlyMinutes: 300,
    maxMinutesPerConversation: 30,
    lifetimeImports: 3,
    seats: 1,
    tagline: "Get started for free",
    features: [
      "300 monthly transcription minutes",
      "30 minutes per conversation",
      "3 lifetime audio/video imports",
      "Live transcription",
      "Speaker identification",
      "Audio playback",
      "Multi-language support",
      "iOS and Android apps",
      "Zoom, Meet, Teams support",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceMonthly: 18,
    priceAnnual: 15,
    monthlyMinutes: 1200,
    maxMinutesPerConversation: 240,
    lifetimeImports: -1,
    seats: 1,
    tagline: "For individuals",
    highlighted: true,
    features: [
      "1,200 monthly transcription minutes",
      "Longer meetings",
      "Unlimited imports",
      "AI summaries",
      "Aurora AI Chat",
      "Advanced search",
      "Export features",
    ],
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    priceMonthly: 30,
    priceAnnual: 25,
    monthlyMinutes: 6000,
    maxMinutesPerConversation: -1,
    lifetimeImports: -1,
    seats: 10,
    tagline: "For teams",
    features: [
      "6,000 monthly minutes",
      "Team workspace",
      "Admin features",
      "Shared custom vocabulary",
      "Speaker tagging",
      "Assign action items to teammates",
      "Usage analytics",
      "Priority support",
      "Advanced search, export, playback",
    ],
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    priceMonthly: null,
    priceAnnual: null,
    monthlyMinutes: -1,
    maxMinutesPerConversation: -1,
    lifetimeImports: -1,
    seats: -1,
    tagline: "Custom pricing",
    features: [
      "SSO / SAML",
      "SCIM provisioning",
      "Domain capture",
      "2FA enforcement",
      "Data retention policies",
      "HIPAA option",
      "Audit logs",
      "Advanced governance",
      "Custom workflows",
      "Enterprise integrations",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["BASIC", "PRO", "BUSINESS", "ENTERPRISE"];
