import type { Metadata } from "next";
import "../globals.css";
import Providers from "@/components/providers";
import { AuthProvider } from "@/contexts/auth.context";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "WaterMirror",
  description: "AI powered Interviews",
  openGraph: {
    title: "WaterMirror",
    description: "AI-powered Interviews",
    siteName: "WaterMirror",
    images: [
      {
        url: "/watermirrorlogo.png",
        width: 1200,
        height: 600,
      },
    ],
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/browser-user-icon.ico" />
      </head>
      <body className="font-sans">
        <AuthProvider>
          <Providers>
            {children}
            <Toaster
              toastOptions={{
                classNames: {
                  toast: "bg-white border-2 border-indigo-400",
                  title: "text-black",
                  description: "text-red-400",
                  actionButton: "bg-indigo-400",
                  cancelButton: "bg-orange-400",
                  closeButton: "bg-lime-400",
                },
              }}
            />
          </Providers>
        </AuthProvider>
      </body>
    </html>
  );
}
