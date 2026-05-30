declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string, options?: { url?: string });
    window: {
      document: Document;
    };
  }
}

declare module "sanitize-html" {
  interface SanitizeHtmlDefaults {
    allowedTags: string[];
    allowedAttributes: Record<string, string[]>;
  }

  interface SanitizeHtmlModule {
    (value: string, options?: Record<string, unknown>): string;
    defaults: SanitizeHtmlDefaults;
    simpleTransform: (
      tagName: string,
      attributes: Record<string, string>
    ) => Record<string, unknown>;
  }

  const sanitizeHtml: SanitizeHtmlModule;
  export = sanitizeHtml;
}

declare module "turndown" {
  interface TurndownOptions {
    headingStyle?: string;
    codeBlockStyle?: string;
    bulletListMarker?: string;
  }

  class TurndownService {
    constructor(options?: TurndownOptions);
    turndown(value: string): string;
  }

  export = TurndownService;
}
