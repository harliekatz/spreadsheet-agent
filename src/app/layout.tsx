import type { Metadata, Viewport } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spreadsheet Agent",
  description:
    "An AI-assisted spreadsheet workspace. Describe a sheet in plain language, watch it get built from a synthetic dataset, and trace every value back to its source.",
  applicationName: "Spreadsheet Agent",
  authors: [{ name: "Harlie Katz", url: "https://harliekatz.netlify.app" }],
  openGraph: {
    title: "Spreadsheet Agent",
    description:
      "Describe a sheet in plain language, watch it get built, and trace every value back to its source. Portfolio project using synthetic data only.",
    type: "website",
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b6b45",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#workspace-main">
          Skip to the spreadsheet
        </a>
        {/* The assistant sits after the workspace in the DOM, so keyboard users
            get a direct route to it rather than tabbing through every row. */}
        <a className="skip-link skip-link-second" href="#agent-prompt">
          Skip to the assistant
        </a>
        {children}
      </body>
    </html>
  );
}
