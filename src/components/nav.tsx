"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ListChecks,
  FileText,
  ScrollText,
  Send,
  Users,
  Gem,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/rules", label: "Rules", icon: ListChecks },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/test", label: "Manual test", icon: Send },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1.5 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground group-data-[collapsible=icon]:size-7">
            <Gem className="size-4" aria-hidden="true" />
          </div>
          {!collapsed ? (
            <div className="leading-tight">
              <p className="text-sm font-semibold">Maya Sanghavi</p>
              <p className="text-xs text-sidebar-foreground/70">
                WhatsApp automation
              </p>
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarMenu>
            {links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <SidebarMenuItem key={link.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={link.label}
                  >
                    <Link href={link.href} aria-current={active ? "page" : undefined}>
                      <Icon aria-hidden="true" />
                      <span>{link.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-1">
          {!collapsed ? (
            <span className="text-xs text-sidebar-foreground/70">Theme</span>
          ) : null}
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
