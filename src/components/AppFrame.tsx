"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Squares2X2Icon,
  RectangleStackIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import {
  Squares2X2Icon as Squares2X2SolidIcon,
  RectangleStackIcon as RectangleStackSolidIcon,
  UserCircleIcon as UserCircleSolidIcon,
} from "@heroicons/react/24/solid";
import { AppShell } from "@astryxdesign/core/AppShell";
import { SideNav, SideNavItem } from "@astryxdesign/core/SideNav";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";

const NAV = [
  { href: "/", label: "Sets", icon: Squares2X2Icon, selectedIcon: Squares2X2SolidIcon },
  {
    href: "/collection",
    label: "Collection",
    icon: RectangleStackIcon,
    selectedIcon: RectangleStackSolidIcon,
  },
  { href: "/account", label: "Account", icon: UserCircleIcon, selectedIcon: UserCircleSolidIcon },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/sets");
  return pathname === href || pathname.startsWith(`${href}/`);
}

// usePathname() is request-time data, so it lives in a Suspense boundary of its own.
function NavItems({ pathname }: { pathname: string | null }) {
  return NAV.map((item) => (
    <SideNavItem
      key={item.href}
      href={item.href}
      label={item.label}
      icon={item.icon}
      selectedIcon={item.selectedIcon}
      isSelected={pathname != null && isActive(pathname, item.href)}
    />
  ));
}

function ActiveNavItems() {
  return <NavItems pathname={usePathname()} />;
}

export function AppFrame({ userMenu, children }: { userMenu: ReactNode; children: ReactNode }) {
  return (
    <AppShell
      height="fill"
      variant="elevated"
      contentPadding={6}
      topNav={
        <TopNav
          label="Top navigation"
          heading={<TopNavHeading heading="TCG Tracker" headingHref="/" />}
          endContent={userMenu}
        />
      }
      sideNav={
        <SideNav
          collapsible
          resizable={{ defaultWidth: 220, minWidth: 180, maxWidth: 320, autoSaveId: "app-side-nav" }}
        >
          <Suspense fallback={<NavItems pathname={null} />}>
            <ActiveNavItems />
          </Suspense>
        </SideNav>
      }
    >
      {children}
    </AppShell>
  );
}
