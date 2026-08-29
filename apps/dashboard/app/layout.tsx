import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ticket Bot Dashboard",
  description: "Configure your Discord ticket system",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/logo-256.png", apple: "/logo-256.png" },
  appleWebApp: { capable: true, title: "Ticket Bot" },
};

export const viewport = { themeColor: "#5865f2" };

// Runs before first paint so an explicit light/dark choice doesn't flash.
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
