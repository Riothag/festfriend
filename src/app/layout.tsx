import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fest Friend",
  description: "Your pocket guide to Jazz Fest. Schedules, stages, food, and bios.",
  manifest: "/manifest.webmanifest",
  applicationName: "Fest Friend",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fest Friend",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const isProd = process.env.NODE_ENV === "production";
  // In production: register the service worker for offline + add-to-home-screen.
  // In dev: actively UNREGISTER any previously-registered SW so the browser
  // stops serving stale cached chunks as we iterate. This was causing fixes to
  // not show up until a hard refresh.
  const swScript = isProd
    ? `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function(){});
        });
      }
    `
    : `
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function (regs) {
          regs.forEach(function (r) { r.unregister(); });
        }).catch(function () {});
        if (window.caches) {
          caches.keys().then(function (keys) {
            keys.forEach(function (k) { caches.delete(k); });
          }).catch(function () {});
        }
      }
    `;
  return (
    <html lang="en">
      <body className="antialiased bg-black text-white">
        {children}
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      </body>
    </html>
  );
}
