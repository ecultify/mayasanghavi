// Central, typed access to environment configuration. Reads at call time so a
// missing secret surfaces a clear error in the relevant code path rather than a
// crash at import. Never logs secret values.

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required env var ${name}. Set it in .env.local (local) or the Railway Variables panel (deploy).`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

export const env = {
  // Meta WhatsApp Cloud API
  waToken: () => required("WA_TOKEN"),
  waPhoneNumberId: () => optional("WA_PHONE_NUMBER_ID", "479129835283946"),
  waWabaId: () => optional("WA_WABA_ID", "488367757690178"),
  waAppId: () => optional("WA_APP_ID", "1016104521118501"),

  // Zoho CRM
  zohoClientId: () =>
    optional("ZOHO_CLIENT_ID", "1000.22O4TPG5UST4YRMV59WPQZ3IJX4JJW"),
  zohoClientSecret: () => required("ZOHO_CLIENT_SECRET"),
  zohoRefreshToken: () => required("ZOHO_REFRESH_TOKEN"),

  // App
  adminToken: () => required("ADMIN_TOKEN"),
  runTimezone: () => optional("RUN_TIMEZONE", "Asia/Kolkata"),
} as const;

// Graph API + Zoho hosts (data center is US for this account).
export const GRAPH_BASE = "https://graph.facebook.com/v25.0";
export const ZOHO_API_BASE = "https://www.zohoapis.com";
export const ZOHO_ACCOUNTS_BASE = "https://accounts.zoho.com";
