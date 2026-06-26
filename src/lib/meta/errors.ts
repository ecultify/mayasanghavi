// Human-readable explanations for the Meta WhatsApp error codes staff will see
// most often in delivery logs. Keep messages plain and actionable.
export const META_ERROR_MAP: Record<string, string> = {
  "131049":
    "Frequency cap: Meta limited marketing sends to this user to protect their experience. Try again later.",
  "131026":
    "Undeliverable: the number cannot receive WhatsApp messages (not on WhatsApp, or blocked).",
  "132001":
    "Template missing or not approved: the template name/language does not match an approved template.",
  "132000":
    "Parameter count mismatch: the number of variables sent does not match the template definition.",
  "132005":
    "Template paused: the template was paused by Meta due to low quality. Edit and resubmit.",
  "132007":
    "Template format error: a parameter (text, image) does not match what the template expects.",
  "133010":
    "Phone number not registered on the Cloud API. Complete number registration first.",
  "190": "Access token issue: WA_TOKEN is expired or invalid. Generate a new system user token.",
  "100": "Invalid parameter: a field in the request was malformed or not allowed.",
  "10": "Permission denied: the token lacks permission for this action (check WABA roles).",
  "368":
    "Temporarily blocked for policy violations. Review WhatsApp commerce/messaging policy.",
  "80007": "Rate limit reached on the WhatsApp Business Account. Slow down sends.",
  "131047":
    "Re-engagement message: more than 24h since the user's last message; only templates are allowed (this is expected for automation).",
  "131051": "Unsupported message type for this recipient.",
  "0": "Unknown error from Meta. See the raw error detail.",
};

export function explainMetaError(code: string | null | undefined): string {
  if (!code) return "No error code reported.";
  return META_ERROR_MAP[code] ?? `Meta error ${code} (no friendly mapping yet).`;
}
