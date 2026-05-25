import type { Metadata } from "next";
import { APP_DESCRIPTION, APP_NAME } from "../lib/constants/app";
import "ol/ol.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                try {
                  var theme = window.localStorage.getItem('eva-webgis-theme');
                  var fontSize = window.localStorage.getItem('eva-webgis-font-size');
                  var root = document.documentElement;

                  if (theme === 'light' || theme === 'dark') {
                    root.dataset.theme = theme;
                  }

                  if (fontSize === 'sm' || fontSize === 'md' || fontSize === 'lg') {
                    root.dataset.fontSize = fontSize;
                  }
                } catch (error) {}
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
