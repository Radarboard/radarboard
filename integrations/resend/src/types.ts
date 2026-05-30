/**
 * Resend — Data types
 *
 * Config and API response types for the Resend email API.
 */

/** Configuration for the Resend integration. */
export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  toEmail: string;
}

/** Options for sending an email via Resend. */
export interface SendEmailOptions {
  to?: string | string[];
  subject: string;
  html: string;
  text?: string;
  tags?: { name: string; value: string }[];
}

/** Response from the send-email endpoint. */
export interface SendEmailResponse {
  id: string;
}

/** An email record returned by the list/get endpoints. */
export interface ResendEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  created_at: string;
  last_event: string;
}
