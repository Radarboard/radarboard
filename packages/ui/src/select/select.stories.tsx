/* biome-ignore-all assist/source/organizeImports: Storybook story file. */
/* biome-ignore-all lint/correctness/noUndeclaredDependencies: Storybook packages live in apps/storybook. */
/* biome-ignore-all lint/style/noDefaultExport: Storybook CSF requires a default export. */
/* biome-ignore-all lint/style/useNamingConvention: Storybook story exports and metadata follow Storybook conventions. */
import { fn } from "storybook/test";
import preview from "@radarboard/storybook-preview";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectSearch,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@radarboard/ui/select";

const meta = preview.meta({
  title: "UI/Select",
  component: Select,
  parameters: {
    layout: "centered",
  },
  args: {
    defaultValue: "production",
    onValueChange: fn(),
  },
  argTypes: {
    defaultValue: {
      control: "text",
    },
  },
});

export default meta;

export const Playground = meta.story({
  render: (args) => (
    <div className="w-[240px]">
      <Select {...args}>
        <SelectTrigger>
          <SelectValue placeholder="Select environment…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="production">Production</SelectItem>
          <SelectItem value="staging">Staging</SelectItem>
          <SelectItem value="development">Development</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
});

export const Variants = meta.story({
  render: () => (
    <div className="flex flex-wrap items-start gap-4">
      {(["default", "surface", "ghost", "outline"] as const).map((variant) => (
        <div key={variant} className="w-[180px] space-y-1">
          <span className="font-mono text-w-sm dark:text-dim">{variant}</span>
          <Select defaultValue="next">
            <SelectTrigger variant={variant}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="next">Next.js</SelectItem>
              <SelectItem value="vite">Vite</SelectItem>
              <SelectItem value="astro">Astro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  ),
});

export const Sizes = meta.story({
  render: () => (
    <div className="flex flex-wrap items-start gap-4">
      {(["sm", "default", "lg", "xl"] as const).map((size) => (
        <div key={size} className="w-[180px] space-y-1">
          <span className="font-mono text-w-sm dark:text-dim">{size}</span>
          <Select defaultValue="next">
            <SelectTrigger size={size}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="next">Next.js</SelectItem>
              <SelectItem value="vite">Vite</SelectItem>
              <SelectItem value="astro">Astro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  ),
});

export const WithPlaceholder = meta.story({
  render: () => (
    <div className="w-[240px]">
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select a framework…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="next">Next.js</SelectItem>
          <SelectItem value="vite">Vite</SelectItem>
          <SelectItem value="astro">Astro</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
});

export const WithGroups = meta.story({
  render: () => (
    <div className="w-[240px]">
      <Select defaultValue="gpt-4o">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectGroupLabel>OpenAI</SelectGroupLabel>
            <SelectItem value="gpt-4o">GPT-4o</SelectItem>
            <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
            <SelectItem value="o1">o1</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectGroupLabel>Anthropic</SelectGroupLabel>
            <SelectItem value="claude-opus">Claude Opus</SelectItem>
            <SelectItem value="claude-sonnet">Claude Sonnet</SelectItem>
            <SelectItem value="claude-haiku">Claude Haiku</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectGroupLabel>Google</SelectGroupLabel>
            <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
            <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
});

export const WithSearch = meta.story({
  render: () => (
    <div className="w-[240px]">
      <Select defaultValue="US">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectSearch />
          <SelectItem value="US" textValue="United States">
            United States
          </SelectItem>
          <SelectItem value="GB" textValue="United Kingdom">
            United Kingdom
          </SelectItem>
          <SelectItem value="CA" textValue="Canada">
            Canada
          </SelectItem>
          <SelectItem value="AU" textValue="Australia">
            Australia
          </SelectItem>
          <SelectItem value="DE" textValue="Germany">
            Germany
          </SelectItem>
          <SelectItem value="FR" textValue="France">
            France
          </SelectItem>
          <SelectItem value="JP" textValue="Japan">
            Japan
          </SelectItem>
          <SelectItem value="BR" textValue="Brazil">
            Brazil
          </SelectItem>
          <SelectItem value="IN" textValue="India">
            India
          </SelectItem>
          <SelectItem value="MX" textValue="Mexico">
            Mexico
          </SelectItem>
          <SelectItem value="KR" textValue="South Korea">
            South Korea
          </SelectItem>
          <SelectItem value="IT" textValue="Italy">
            Italy
          </SelectItem>
          <SelectItem value="ES" textValue="Spain">
            Spain
          </SelectItem>
          <SelectItem value="NL" textValue="Netherlands">
            Netherlands
          </SelectItem>
          <SelectItem value="SE" textValue="Sweden">
            Sweden
          </SelectItem>
          <SelectItem value="NO" textValue="Norway">
            Norway
          </SelectItem>
          <SelectItem value="DK" textValue="Denmark">
            Denmark
          </SelectItem>
          <SelectItem value="FI" textValue="Finland">
            Finland
          </SelectItem>
          <SelectItem value="PT" textValue="Portugal">
            Portugal
          </SelectItem>
          <SelectItem value="CH" textValue="Switzerland">
            Switzerland
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
});

export const Disabled = meta.story({
  render: () => (
    <div className="flex flex-wrap items-start gap-4">
      <div className="w-[180px] space-y-1">
        <span className="font-mono text-w-sm dark:text-dim">Disabled trigger</span>
        <Select defaultValue="next" disabled>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="next">Next.js</SelectItem>
            <SelectItem value="vite">Vite</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-[180px] space-y-1">
        <span className="font-mono text-w-sm dark:text-dim">Disabled item</span>
        <Select defaultValue="next">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="next">Next.js</SelectItem>
            <SelectItem value="vite" disabled>
              Vite (unavailable)
            </SelectItem>
            <SelectItem value="astro">Astro</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  ),
});
