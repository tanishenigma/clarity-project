import type { Metadata } from "next";
import { Syne } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { PersonalizationProvider } from "@/lib/personalization-context";
import { COLOR_THEMES } from "@/lib/color-themes";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000");

const bootstrapThemeMap = Object.fromEntries(
  COLOR_THEMES.map((theme) => [theme.id, { l: theme.light, d: theme.dark }]),
);

const colorThemeBootstrapScript = `(function(){try{var id=localStorage.getItem('color-theme');if(!id)return;var themes=${JSON.stringify(bootstrapThemeMap)};var t=themes[id];if(!t)return;var lv=Object.entries(t.l).map(function(e){return e[0]+':'+e[1]}).join(';');var dv=Object.entries(t.d).map(function(e){return e[0]+':'+e[1]}).join(';');var s=document.createElement('style');s.id='color-theme-override';s.textContent=':root{'+lv+'} .dark{'+dv+'}';document.head.appendChild(s);}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  icons: {
    icon: [
      {
        url: "/logo_small_light.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/logo_small_dark.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    shortcut: [
      {
        url: "/logo_small_light.svg",
        type: "image/svg+xml",
      },
    ],
  },
  title: {
    default: "Clarity | Your Personal Learning Companion",
    template: "%s | Clarity",
  },
  description:
    "Master any subject with Clarity. Interactive lessons, real-time feedback, and adaptive learning paths designed just for you.",
  keywords: [
    "Clarity",
    "online learning",
    "education",
    "homework help",
    "personalized study",
    "edtech",
  ],
  authors: [{ name: "Your Team Name" }],
  creator: "Your Team Name",
  publisher: "Your Team Name",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://your-domain.com",
    title: "Clarity | Your Personal Learning Companion",
    description: "Master any subject with Clarity.",
    siteName: "Clarity",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Clarity Dashboard Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Clarity | Your Personal Learning Companion",
    description: "Master any subject with Clarity.",
    images: ["/og-image.jpg"],
    creator: "@yourtwitterhandle",
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Restore persisted color theme before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: colorThemeBootstrapScript,
          }}
        />
      </head>
      <body className={`${syne.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange>
          <AuthProvider>
            <PersonalizationProvider>{children}</PersonalizationProvider>
          </AuthProvider>
        </ThemeProvider>
        {/* <Analytics /> */}
      </body>
    </html>
  );
}
