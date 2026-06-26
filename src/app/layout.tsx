import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppSidebar } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";
import { cookies } from "next/headers";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Maya Sanghavi Jewels: WhatsApp Automation",
  description:
    "Birthday and anniversary WhatsApp automation, rules, templates, and delivery logs.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Restore the persisted open/collapsed state from the cookie (no localStorage).
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar:state")?.value !== "false";

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Skip to main content
          </a>
          <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar />
            <SidebarInset>
              {/* Top bar with the sidebar toggle. */}
              <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <SidebarTrigger />
                <Separator orientation="vertical" className="h-5" />
                <span className="text-sm font-medium text-muted-foreground">
                  Maya Sanghavi Jewels
                </span>
              </header>
              <main
                id="main-content"
                className="flex-1 overflow-x-hidden p-4 md:p-8"
              >
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
