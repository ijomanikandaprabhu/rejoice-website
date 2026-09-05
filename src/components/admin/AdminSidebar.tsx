'use client';

import {
  ExternalLink,
  Inbox,
  LayoutDashboard,
  LogOut,
  Music,
  Settings,
  Tv,
  Video,
  FileText,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { adminNav } from '@/config/app.config';

/** Icons keyed by route, so the nav order stays owned by config (DRY). */
const ICONS: Record<string, typeof LayoutDashboard> = {
  '/admin': LayoutDashboard,
  '/admin/youtube-channels': Tv,
  '/admin/youtube-content': Video,
  '/admin/songs': Music,
  '/admin/website-content': FileText,
  '/admin/enquiries': Inbox,
  '/admin/settings': Settings,
};

export function AdminSidebar({
  email,
  logout,
  newEnquiries = 0,
}: {
  email: string;
  logout: () => Promise<void>;
  newEnquiries?: number;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/admin">
                <Image
                  src="/brand/logo-wordmark-light.png"
                  alt="Rejoice"
                  width={687}
                  height={169}
                  className="h-6 w-auto shrink-0 group-data-[collapsible=icon]:hidden"
                />
                <span className="hidden text-xs text-muted-foreground group-data-[collapsible=icon]:block">
                  R
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminNav.map((item) => {
                const Icon = ICONS[item.href] ?? LayoutDashboard;
                const showBadge = item.href === '/admin/enquiries' && newEnquiries > 0;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.label}
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                        {showBadge ? (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                            {newEnquiries}
                          </span>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="View website">
              <a href="/" target="_blank" rel="noopener noreferrer">
                <ExternalLink />
                <span>View website</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <form action={logout} className="w-full">
              <SidebarMenuButton asChild tooltip="Log out">
                <button type="submit" className="w-full">
                  <LogOut />
                  <span className="truncate">{email || 'Log out'}</span>
                </button>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
