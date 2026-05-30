import type { PluginDescriptor } from "@radarboard/plugin-sdk/types";
import { Receipt } from "lucide-react";
import { ExpensesOverlay } from "./components/expenses-overlay";
import { expensesMcpTools } from "./mcp-tools";

export const expensesDescriptor: PluginDescriptor = {
  id: "expenses",
  name: "Expenses",
  description: "Track service costs, billing cycles, and upcoming renewals across your stack",
  icon: Receipt,
  category: "productivity",
  version: "0.1.0",

  launchSurfaces: ["palette", "topbar"],
  presentation: { default: "fullscreen", alternates: ["side-panel"], size: "lg" },
  shortcut: "Mod+Shift+X",

  component: ExpensesOverlay,

  mcpTools: expensesMcpTools,

  dataSources: [
    {
      id: "vercel-billing",
      name: "Vercel Billing",
      description: "Auto-sync monthly costs from Vercel",
      connectionTypes: ["api_key"],
      integrationKey: "vercel",
    },
    {
      id: "github-billing",
      name: "GitHub Billing",
      description: "Auto-sync monthly costs from GitHub organization",
      connectionTypes: ["api_key"],
      integrationKey: "github",
    },
  ],

  settings: [
    {
      key: "currency",
      label: "Currency",
      description: "Default currency for expense tracking",
      type: "select",
      defaultValue: "USD",
      options: [
        { label: "USD ($)", value: "USD" },
        { label: "EUR (\u20AC)", value: "EUR" },
        { label: "GBP (\u00A3)", value: "GBP" },
        { label: "CAD (C$)", value: "CAD" },
        { label: "BRL (R$)", value: "BRL" },
      ],
    },
    {
      key: "renewal-warning-days",
      label: "Renewal Warning (days)",
      description: "Days before renewal to show a warning",
      type: "number",
      defaultValue: 7,
    },
  ],
};
