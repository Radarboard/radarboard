# Radarboard — Product Capabilities

> This document describes everything the Radarboard web application can do. Use it as context for designing landing pages, marketing copy, or product documentation.

---

## 1. Product Overview

**Radarboard** is a real-time business dashboard that aggregates data from 21+ services into a single, customizable interface. It is built for indie developers, solo founders, and small teams who ship apps, SaaS products, and open-source projects and need a unified view of revenue, analytics, deployments, errors, and project health.

### Target Audience
- Indie hackers and solo founders
- Small product teams (2–10 people)
- Open-source maintainers
- Mobile app developers (iOS/Android)
- SaaS operators

### Elevator Pitch
One dashboard for everything: revenue from Stripe, downloads from App Store Connect, errors from Sentry, deployments from Vercel, stars from GitHub, analytics from Umami — all in one place, with an AI assistant that can analyze trends and anomalies across all your data sources.

### Key Differentiators
- **All-in-one**: 21 integrations, 20 widgets, 10 plugins — no need to tab between services
- **AI-powered**: Built-in assistant that understands your data and can surface insights
- **Extensible**: SDK-based architecture — build your own integrations, widgets, and plugins
- **Self-hostable**: Runs on your own infrastructure with your choice of database
- **Privacy-first**: Credentials encrypted with AES-256-GCM, data stays on your infrastructure

---

## 2. Dashboard & Layout System

The dashboard is the core experience — a customizable grid of widgets showing real-time data from connected services.

### Layout Features
- **Drag-and-drop widget placement** using dnd-kit — rearrange widgets freely
- **Resizable columns** with horizontal drag handles to adjust widget widths
- **Responsive design**: single column on mobile, 2-column on tablet, flexible grid on desktop
- **Multiple pages/tabs**: create different dashboard views (e.g., "Revenue", "Engineering", "Marketing")
- **Multi-project support**: switch between projects via tabs — each project has its own dashboard, integrations, and configuration
- **KPI strip**: a top bar showing key metrics at a glance
- **Bottom ticker**: a scrolling real-time feed of events and updates
- **Dark and light themes** with Geist UI design system

### Dashboard Chrome
- Top bar with navigation, project switcher, and quick actions
- Project tabs for switching between monitored projects
- Settings access from the dashboard
- Plugin dock/sidebar for quick plugin access
- Keyboard shortcuts for common actions (Cmd/Ctrl + key combinations)

---

## 3. Integrations (21 Services)

Each integration connects to an external service to pull data, expose widgets, and provide tools for the AI assistant.

### Development & Code
| Integration | What It Provides |
|---|---|
| **GitHub** | Repository activity, commits, pull requests, issues, releases, star history |
| **GitHub Sponsors** | Sponsor count, revenue, sponsor tier data |
| **Linear** | Issue tracking, project status, team velocity, webhook support |
| **Vercel** | Deployment status and history, build performance, domain health |
| **Astro** | Static site build and deployment metrics |

### Revenue & Monetization
| Integration | What It Provides |
|---|---|
| **Stripe** | MRR, subscriptions, charges, refunds, revenue trends |
| **RevenueCat** | Mobile app subscription revenue, trial conversions, churn |
| **Open Collective** | Crowdfunding totals, backer count, expense tracking |
| **GitHub Sponsors** | Sponsorship revenue and tiers |

### Analytics & SEO
| Integration | What It Provides |
|---|---|
| **Umami** | Page views, visitors, referrers, browser/device stats |
| **OpenPanel** | Product analytics, events, funnels |
| **Google Search Console** | Search impressions, clicks, CTR, keyword rankings |
| **App Store Connect** | iOS app downloads, ratings, reviews, app analytics |

### Monitoring & Reliability
| Integration | What It Provides |
|---|---|
| **Sentry** | Error tracking, crash reports, performance metrics |
| **BetterStack** | Uptime monitoring, incident history, response times |
| **PagerDuty** | On-call schedules, incident response, escalation status |

### Communication & Notifications
| Integration | What It Provides |
|---|---|
| **Slack** | Team notifications, channel alerts |
| **Discord** | Community engagement, notification delivery |
| **Resend** | Email delivery stats, campaign metrics |

### Content & Bookmarks
| Integration | What It Provides |
|---|---|
| **Raindrop** | Bookmark collections, saved links, reading lists |
| **NPM** | Package download stats, version tracking |

### Composite
| Integration | What It Provides |
|---|---|
| **Release Activity** | Release tracking combining GitHub, Linear, and Vercel data |

---

## 4. Widgets (20 Dashboard Components)

Widgets are the visual building blocks of the dashboard. Each can be configured, resized, and placed anywhere on the grid.

### Development Metrics
| Widget | What It Shows |
|---|---|
| **Commits** | Git commit history, contribution activity, commit frequency |
| **Pull Requests** | Open/merged/closed PRs, review activity |
| **Builds** | CI/CD pipeline status, build duration, success rate |
| **Deployments** | Deployment history, status (success/fail/pending) |
| **Projects** | Project overview cards with status indicators |
| **Stars** | GitHub star count history with trend charts |

### Business & Revenue
| Widget | What It Shows |
|---|---|
| **Revenue** | Revenue charts and financial metrics across providers |
| **Stripe Revenue** | Stripe-specific MRR, charges, subscription metrics |
| **Sponsorship** | Sponsor count, funding totals, tier breakdown |
| **Downloads** | Package or app download counts over time |

### Analytics & SEO
| Widget | What It Shows |
|---|---|
| **Analytics** | Live pageviews, visitor counts, traffic sources |
| **SEO** | Search rankings, impressions, click-through rates |
| **ASO Keywords** | App Store Optimization keyword rankings and tracking |
| **Review Pulse** | App store review sentiment analysis and trends |

### Infrastructure & Ops
| Widget | What It Shows |
|---|---|
| **Observability** | Error rates, system health indicators |
| **Logs** | Application log aggregation and recent entries |
| **Domains** | Domain and DNS health monitoring |

### Content & Planning
| Widget | What It Shows |
|---|---|
| **Roadmap** | Product roadmap with feature tracking |
| **Raindrop** | Bookmark collections from Raindrop.io |
| **Release Activity** | Release and deployment status |

### Widget Capabilities
- Every widget has a **detail dialog** for expanded views
- **Configuration panel** for customizing data sources and display
- **Visual editor** for real-time config preview
- **Multi-repo picker** for GitHub-connected widgets (select which repositories to monitor)
- Charts powered by Recharts (area, line, bar, sparklines)

---

## 5. Plugins (10 Extensions)

Plugins add standalone tools and utilities accessible from the dock, launcher, or overlay.

### Productivity
| Plugin | What It Does |
|---|---|
| **Tasks** | Task management with drag-and-drop sorting and status tracking |
| **Notes** | Markdown-powered note-taking with rich text support |
| **Bookmarks** | Save and organize bookmarks |
| **Expenses** | Track expenses and budgets |

### Data & Content
| Plugin | What It Does |
|---|---|
| **RSS Reader** | Aggregate and read RSS feeds with background polling |
| **Changelog** | Track and view changelogs for your projects |
| **Embeddings** | Manage text embeddings for semantic search across your data |

### Infrastructure
| Plugin | What It Does |
|---|---|
| **Backup** | Automated data backup and recovery |
| **Status Page** | Monitor external status pages with background polling |
| **Webhook Relay** | Route and manage incoming webhooks from external services |

### Plugin System Features
- **Plugin Launcher**: command-palette style search (Cmd+K) to quickly open any plugin
- **Plugin Dock**: persistent sidebar with quick-access icons
- **Plugin Overlay**: full-screen overlay mode for focused work
- Keyboard shortcuts for each plugin
- Plugin dependency checking (e.g., embeddings plugin requires LLM configuration)

---

## 6. AI Assistant & Chat

Radarboard includes a built-in AI assistant that can understand and analyze data from all connected integrations.

### Chat Interface
- Side drawer chat panel accessible from any dashboard view
- Multi-turn conversations with context preservation
- Conversation history and search
- Model selection — choose between Anthropic Claude, OpenAI, or Google models
- Chat feedback system (thumbs up/down on responses)

### AI Capabilities
- **Cross-service analysis**: "How did our revenue trend compare to our deployment frequency last month?"
- **Anomaly detection**: Automatically surfaces unusual patterns across metrics
- **Trend analysis**: Identifies trends across time-series data from all integrations
- **Morning briefing**: AI-generated daily summary of important changes and anomalies
- **Correlation scanning**: Finds relationships between metrics from different services

### Skills System
The assistant has specialized skills for different analysis domains:
- **Growth Advisor** — SEO, traffic analysis, user acquisition
- **Revenue Analyst** — Financial metrics, churn, MRR trends
- **Infrastructure Monitor** — Error rates, deployment health, uptime
- **Team Productivity** — Commit velocity, PR throughput, issue resolution

### Knowledge & Memory
- **Conversation memory** with embeddings for context recall
- **Artifact management** — save code snippets and analysis results from conversations
- **Knowledge Health Dashboard** — monitor the quality and freshness of assistant knowledge:
  - Stale content detection
  - Attribution quality tracking
  - User feedback aggregation

### MCP (Model Context Protocol)
- Each integration can expose MCP tools the assistant can use
- The assistant can take actions through integrations (not just read data)
- Configurable MCP server connections for extending assistant capabilities

---

## 7. Notification & Alerting System

### Notification Center
- Dropdown and panel views for notification browsing
- Unread count badge with critical alert indicator
- Mark as read/dismiss capabilities

### Delivery Channels
- **In-app notifications** in the notification center
- **Desktop notifications** via browser APIs
- **Sound alerts** with customizable sounds
- **Webhook delivery** to external services

### Configuration
- Per-integration notification rules
- Notification routing and filtering
- Webhook relay for forwarding alerts to Slack, Discord, or custom endpoints

---

## 8. Settings & Customization

The settings panel includes 14+ sections for comprehensive customization.

### Appearance
- Light and dark theme toggle
- Font size scaling
- Ticker scroll speed
- Timezone selection
- Currency display format

### Project Management
- Add, remove, and reorder projects
- Per-project integration configuration
- Per-project dashboard layouts
- Project context map (goals, priorities, notes)

### Integration Management
- Connect/disconnect integrations per project
- OAuth flow for supported services
- API key entry with test-before-save
- Credential rotation and management

### Advanced Settings
- Database provider selection and configuration
- Workflow builder for automation
- MCP server configuration
- Debug tools and diagnostics
- Feature flag management

---

## 9. Data Management

### Export
- Export all dashboard data as versioned JSON
- Includes project configurations, integration connections, layouts
- Useful for backup or migration

### Import
- Restore from previously exported JSON
- Recovers project order and integration connections

### Backup Plugin
- Automated scheduled backups
- Data recovery capabilities

### Database Flexibility
- **SQLite** — local, zero-config, great for single-user
- **Supabase** (PostgreSQL) — cloud-hosted, scalable
- **PlanetScale** (MySQL) — serverless MySQL
- **Turso** (LibSQL) — edge-distributed SQLite

---

## 10. Security & Credentials

- **AES-256-GCM encryption** for all stored API keys and tokens
- OAuth flows for services that support it (no raw tokens needed)
- Credential testing before save — verify keys work before storing
- No credentials sent to third parties — all API calls made server-side
- Self-hosted deployment means data never leaves your infrastructure

---

## 11. Technical Architecture Highlights

These details matter for positioning and trust:

- **Next.js 16** with React 19 and Turbopack
- **TypeScript** throughout the entire codebase
- **Monorepo** with strict module boundaries enforced by linting
- **SDK-based extensibility** — integration-sdk, widget-sdk, plugin-sdk for building custom extensions
- **Drizzle ORM** with multi-database support (swap providers without code changes)
- **SWR** for data fetching with smart caching and revalidation
- **Rate limiting** built into API routes
- **Webhook support** for real-time data from GitHub, Vercel, Linear, Sentry, BetterStack
- **Event streaming** for real-time dashboard updates
- **OpenTelemetry** observability support

---

## 12. Setup & Onboarding

### Setup Wizard (First Run)
1. **Database selection** — choose SQLite, PostgreSQL, MySQL, or LibSQL
2. **Credential configuration** — enter database credentials with connection testing
3. **Migration** — automatic schema setup and completion

### Onboarding Wizard
- Guided walkthrough of featured integrations
- Step-by-step integration connection
- Demo mode with sample data
- Progress tracking through setup steps

---

## 13. Summary of Numbers

| Category | Count |
|---|---|
| Integrations | 21 |
| Widgets | 20 |
| Plugins | 10 |
| Settings sections | 14+ |
| API endpoints | 90+ |
| Supported databases | 4 |
| LLM providers | 3 (Anthropic, OpenAI, Google) |
| AI assistant skills | 4 specialized domains |

---

## 14. Key User Workflows

These are the primary things users do in Radarboard:

1. **Monitor everything in one place** — open the dashboard and see revenue, errors, deployments, and analytics at a glance
2. **Investigate anomalies** — notice a metric spike, ask the AI assistant to analyze it across services
3. **Track project health** — switch between projects, each with tailored widgets and integrations
4. **Stay informed** — morning briefings, real-time notifications, bottom ticker for events
5. **Manage tasks and notes** — use built-in plugins without leaving the dashboard
6. **Customize their view** — drag widgets, resize columns, create multiple pages, set themes
7. **Connect new services** — add integrations through OAuth or API keys in settings
8. **Export and back up** — keep data safe with JSON exports and automated backups
