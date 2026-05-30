import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import sanitizeHtml from "sanitize-html";
import TurndownService from "turndown";

const RSS_FETCH_TIMEOUT_MS = 15_000;

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function stripHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  const withoutTags = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6)>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .trim();

  const normalized = normalizeWhitespace(decodeHtmlEntities(withoutTags));
  return normalized.length > 0 ? normalized : null;
}

function sanitizeReaderHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  const sanitized = sanitizeHtml(decodeHtmlEntities(value), {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "figure",
      "figcaption",
      "pre",
      "code",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),
    },
  }).trim();

  return sanitized.length > 0 ? sanitized : null;
}

function resolveAbsoluteUrl(baseUrl: string, value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeImageUrl(url: string | null): string | null {
  if (!url) return null;
  const normalized = url.trim();
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (
    lowered.endsWith(".svg") ||
    lowered.includes("/avatar") ||
    lowered.includes("/logo") ||
    lowered.includes("gravatar")
  ) {
    return null;
  }
  return normalized;
}

function imageFromMeta(document: Document, pageUrl: string): string | null {
  return normalizeImageUrl(
    resolveAbsoluteUrl(
      pageUrl,
      document
        .querySelector(
          'meta[property="og:image"], meta[name="twitter:image"], meta[property="og:image:url"]'
        )
        ?.getAttribute("content")
    )
  );
}

function normalizeCaption(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeWhitespace(decodeHtmlEntities(stripHtml(value) ?? value));
  return normalized.length > 0 ? normalized : null;
}

function imageCaptionFromMeta(document: Document): string | null {
  return normalizeCaption(
    document
      .querySelector('meta[property="og:image:alt"], meta[name="twitter:image:alt"]')
      ?.getAttribute("content")
  );
}

function sameImageCandidate(left: string, right: string): boolean {
  try {
    const leftUrl = new URL(left);
    const rightUrl = new URL(right);
    return `${leftUrl.origin}${leftUrl.pathname}` === `${rightUrl.origin}${rightUrl.pathname}`;
  } catch {
    return left === right;
  }
}

function imageCaptionFromFigure(
  document: Document,
  pageUrl: string,
  imageUrl: string | null
): string | null {
  if (!imageUrl) return null;

  const figures = Array.from(document.querySelectorAll("figure"));
  for (const figure of figures) {
    const image = figure.querySelector("img");
    const source = normalizeImageUrl(resolveAbsoluteUrl(pageUrl, image?.getAttribute("src")));
    if (!source || !sameImageCandidate(source, imageUrl)) continue;

    const caption = normalizeCaption(figure.querySelector("figcaption")?.textContent);
    if (caption) return caption;
  }

  return null;
}

function imageCaptionFromAttributes(
  document: Document,
  pageUrl: string,
  imageUrl: string | null
): string | null {
  if (!imageUrl) return null;

  const images = Array.from(document.querySelectorAll("article img, main img, img"));
  for (const image of images) {
    const source = normalizeImageUrl(resolveAbsoluteUrl(pageUrl, image.getAttribute("src")));
    if (!source || !sameImageCandidate(source, imageUrl)) continue;

    const caption = normalizeCaption(
      image.getAttribute("alt") || image.getAttribute("title") || image.getAttribute("aria-label")
    );
    if (caption) return caption;
  }

  return null;
}

function imageFromArticleContent(document: Document, pageUrl: string): string | null {
  const candidates = Array.from(
    document.querySelectorAll("article img, main img, img")
  ) as HTMLImageElement[];

  for (const candidate of candidates) {
    const src = normalizeImageUrl(resolveAbsoluteUrl(pageUrl, candidate.getAttribute("src")));
    if (!src) continue;
    const width = Number(candidate.getAttribute("width") ?? "0");
    const height = Number(candidate.getAttribute("height") ?? "0");
    if ((width > 0 && width < 120) || (height > 0 && height < 120)) continue;
    return src;
  }

  return null;
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value) || value.includes("<!--");
}

function toReaderContent(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (looksLikeHtml(trimmed)) {
    const sanitizedHtml = sanitizeReaderHtml(trimmed);
    if (!sanitizedHtml) return null;
    const markdown = turndown.turndown(sanitizedHtml);
    const normalized = decodeHtmlEntities(markdown)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return normalized.length > 0 ? normalized : null;
  }

  const normalized = decodeHtmlEntities(trimmed)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
    },
    signal: AbortSignal.timeout(RSS_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

export async function extractArticleContent(url: string): Promise<{
  content: string | null;
  heroImageUrl: string | null;
  heroImageCaption: string | null;
}> {
  const html = await fetchText(url);
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const result = reader.parse();
  const content = toReaderContent(result?.content ?? null);
  const heroImageUrl =
    imageFromMeta(dom.window.document, url) ?? imageFromArticleContent(dom.window.document, url);
  const heroImageCaption =
    imageCaptionFromFigure(dom.window.document, url, heroImageUrl) ??
    imageCaptionFromMeta(dom.window.document) ??
    imageCaptionFromAttributes(dom.window.document, url, heroImageUrl);

  return {
    content: content && content.length >= 200 ? content : null,
    heroImageUrl: heroImageUrl ?? null,
    heroImageCaption: heroImageCaption ?? null,
  };
}
