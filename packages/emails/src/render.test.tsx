import { describe, expect, it } from "vitest";
import { render } from "./render";
import { WaitlistWelcome } from "./templates/waitlist-welcome";

describe("email rendering", () => {
  it("renders the waitlist welcome email with the provided site URL", async () => {
    const html = await render(<WaitlistWelcome siteUrl="https://radarboard.app" />);

    expect(html).toContain("RADARBOARD");
    expect(html).toContain("early access");
    expect(html).toContain('href="https://radarboard.app"');
  });
});
