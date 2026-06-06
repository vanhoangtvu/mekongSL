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
                  } else {
                    root.dataset.theme = 'light';
                  }

                  if (fontSize === 'sm' || fontSize === 'md' || fontSize === 'lg') {
                    root.dataset.fontSize = fontSize;
                  }
                } catch (error) {}
              })();
            `,
          }}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style dangerouslySetInnerHTML={{
          __html: `*,*::before,*::after{box-sizing:border-box}html{min-height:100%;background:#f8f9fa}body{margin:0;min-height:100vh;background:transparent;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;font-size:1rem;overflow-x:hidden;color:#212529}a{color:inherit;text-decoration:none}.app-container{display:flex;flex-direction:column;height:100dvh;min-height:100dvh;overflow:hidden}.app-main{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden}.app-content{flex:1;display:flex;min-height:0;overflow:hidden}.geo-panel{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden}.app-header{position:relative;z-index:100;background:linear-gradient(135deg,#163c66 0%,#20538c 100%)}.app-header-content{display:flex;align-items:center;justify-content:space-between;gap:1rem;max-width:100%;padding:1rem 2rem}.app-logo{display:inline-flex;align-items:center;gap:0.6rem;font-size:1.3rem;font-weight:700;color:#fff;line-height:1}.app-footer{position:relative;z-index:100;border-top:4px solid #1e4d7a;background:#2563a8;padding:0.75rem}.app-footer-content{max-width:100%;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem}.app-footer-copyright{color:#e8f0fe;font-size:0.8rem;font-weight:500}.app-footer-links{display:flex;flex-wrap:wrap;gap:1.5rem;justify-content:center}.app-footer-links a{color:#e8f0fe;font-size:0.85rem;font-weight:600}`
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
