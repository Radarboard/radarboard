import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface WaitlistWelcomeProps {
  siteUrl?: string;
}

export function WaitlistWelcome({ siteUrl = "https://radarboard.com" }: WaitlistWelcomeProps) {
  return (
    <Html>
      <Head />
      <Preview>You&apos;re on the Radarboard early access list</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>RADARBOARD</Text>
          </Section>

          <Heading style={heading}>You&apos;re in.</Heading>

          <Text style={paragraph}>
            Thanks for signing up for early access. You&apos;re now on the list and we&apos;ll
            notify you as soon as Radarboard is ready.
          </Text>

          <Text style={paragraph}>
            Radarboard brings all your project signals into one dashboard — fewer tabs, more focus.
          </Text>

          <Hr style={hr} />

          <Text style={paragraph}>
            In the meantime, you can check out our{" "}
            <Link href={siteUrl} style={link}>
              website
            </Link>{" "}
            to learn more about what we&apos;re building.
          </Text>

          <Text style={footer}>
            &copy; {new Date().getFullYear()} Radarboard. All rights reserved.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

WaitlistWelcome.PreviewProps = {
  siteUrl: "https://radarboard.com",
} satisfies WaitlistWelcomeProps;

const body: React.CSSProperties = {
  backgroundColor: "#0a0a0a",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  margin: "0",
  padding: "0",
};

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "40px 20px",
};

const header: React.CSSProperties = {
  paddingBottom: "24px",
};

const logo: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 700,
  letterSpacing: "0.15em",
  fontFamily: "monospace",
  margin: "0",
};

const heading: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "32px",
  fontWeight: 900,
  lineHeight: "1.2",
  margin: "0 0 24px",
};

const paragraph: React.CSSProperties = {
  color: "#a0a0a0",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const link: React.CSSProperties = {
  color: "#6366f1",
  textDecoration: "underline",
};

const hr: React.CSSProperties = {
  borderColor: "#262626",
  margin: "24px 0",
};

const footer: React.CSSProperties = {
  color: "#525252",
  fontSize: "12px",
  lineHeight: "1.6",
  margin: "24px 0 0",
};
