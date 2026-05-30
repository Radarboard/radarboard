import { render } from "@radarboard/emails/render";
import { WaitlistWelcome } from "@radarboard/emails/waitlist-welcome";
import { PRODUCT_WAITLIST_SUBJECT } from "@radarboard/product";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
});

// Simple in-memory rate limiter (resets on cold start — fine for a waitlist)
const rateMap = new Map<string, number[]>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateMap.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) return true;
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  return false;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ success: false, message: "Too many requests" }, { status: 429 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !audienceId || !fromEmail) {
    return NextResponse.json({ success: false, message: "Service unavailable" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid email address" }, { status: 400 });
  }

  const resend = new Resend(apiKey);
  const { email } = parsed.data;

  try {
    // Add contact to Resend Audience
    const { error: contactError } = await resend.contacts.create({
      audienceId,
      email,
    });

    // Duplicate contact — treat as success, skip welcome email
    if (contactError) {
      if ("statusCode" in contactError && contactError.statusCode === 409) {
        return NextResponse.json({ success: true, message: "You're already on the list!" });
      }
      throw new Error(contactError.message);
    }

    // Send welcome email
    const html = await render(WaitlistWelcome({}));

    const { error: emailError } = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: PRODUCT_WAITLIST_SUBJECT,
      html,
    });

    if (emailError) {
      // Contact was added — don't fail the whole request over the welcome email
    }

    return NextResponse.json({ success: true, message: "You're in! Check your inbox." });
  } catch {
    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
