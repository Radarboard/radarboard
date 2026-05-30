/**
 * Resend — MCP tool definitions
 *
 * Define MCP tools that expose this integration's capabilities
 * to LLMs via the Model Context Protocol.
 */

import { z } from "zod";

export const resendMcpTools = [
  {
    name: "send-email",
    description: "Send an email via Resend (subject, html body, optional text fallback)",
    parameters: z.object({
      subject: z.string().describe("Email subject line"),
      html: z.string().describe("HTML body content"),
      text: z.string().optional().describe("Plain-text fallback body"),
      to: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe("Recipient(s) — defaults to the configured toEmail"),
    }),
    execute: async (_params: {
      subject: string;
      html: string;
      text?: string;
      to?: string | string[];
    }) => {
      // Placeholder — implementation pending
      return { status: "not_implemented" };
    },
  },
  {
    name: "get-recent-emails",
    description: "List recent emails sent via Resend (for audit/debugging)",
    parameters: z.object({
      limit: z.number().optional().default(10).describe("Max number of emails to return"),
    }),
    execute: async (_params: { limit?: number }) => {
      // Placeholder — implementation pending
      return { status: "not_implemented" };
    },
  },
];
