"use client";

import Link from "next/link";
import Image from "next/image";
import { redirect, usePathname } from "next/navigation";
import logoLight from "@/public/logo_light.png";
import logoDark from "@/public/logo_dark.png";
import logoSmallLight from "@/public/logo_small_light.svg";
import logoSmallDark from "@/public/logo_small_dark.svg";
import {
  Brain,
  LogIn,
  PanelLeft,
  // BarChart3,
  LayoutDashboard,
  Layers2,
  SquarePen,
  ChevronRight,
  ChevronDown,
  Settings,
  LogOut,
  Plus,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";

interface SidebarProps {
  spaceId?: string;
}

export function Sidebar({ spaceId }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showSideBar, setShowSideBar] = useState(true);
  const [spacesOpen, setSpacesOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [spaces, setSpaces] = useState<
    { _id: string; name: string; icon: string }[]
  >([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const newSpace = (
        e as CustomEvent<{ _id: string; name: string; icon: string }>
      ).detail;
      if (!newSpace?._id) return;
      setSpaces((prev) => {
        if (prev.some((s) => s._id === newSpace._id)) return prev;
        return [newSpace, ...prev];
      });
    };
    window.addEventListener("space-created", handler);
    return () => window.removeEventListener("space-created", handler);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const { _id } = (e as CustomEvent<{ _id: string }>).detail;
      if (!_id) return;
      setSpaces((prev) => prev.filter((s) => s._id !== _id));
    };
    window.addEventListener("space-deleted", handler);
    return () => window.removeEventListener("space-deleted", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/spaces?userId=${user.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.spaces) {
          const fetched: { _id: string; name: string; icon: string }[] =
            data.spaces;
          const savedOrder = localStorage.getItem(
            `sidebar-spaces-order-${user.id}`,
          );
          if (savedOrder) {
            try {
              const ids: string[] = JSON.parse(savedOrder);
              const map = new Map(fetched.map((s) => [s._id, s]));
              const ordered = ids
                .filter((id) => map.has(id))
                .map((id) => map.get(id)!);
              fetched.forEach((s) => {
                if (!ids.includes(s._id)) ordered.push(s);
              });
              setSpaces(ordered);
            } catch {
              setSpaces(fetched);
            }
          } else {
            setSpaces(fetched);
          }
        }
      })
      .catch(() => {});
  }, [user]);

  const handleDragStart = (idx: number) => setDragIndex(idx);

  const handleDragEnter = (idx: number) => {
    if (idx !== dragIndex) setDragOverIndex(idx);
  };

  const handleDragEnd = () => {
    if (
      dragIndex !== null &&
      dragOverIndex !== null &&
      dragIndex !== dragOverIndex
    ) {
      setSpaces((prev) => {
        const updated = [...prev];
        const [moved] = updated.splice(dragIndex, 1);
        updated.splice(dragOverIndex, 0, moved);
        if (user) {
          const orderedIds = updated.map((s) => s._id);
          localStorage.setItem(
            `sidebar-spaces-order-${user.id}`,
            JSON.stringify(orderedIds),
          );
          window.dispatchEvent(
            new CustomEvent("space-reordered", { detail: { ids: orderedIds } }),
          );
        }
        return updated;
      });
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/add-content", icon: Plus, label: "Add Content" },
    { href: "/spaces", icon: Layers2, label: "Spaces" },
    { href: "/chat", icon: SquarePen, label: "Chat" },
    // { href: "/study/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/notes", icon: StickyNote, label: "Notes" },
  ];

  const toggleSidebar = (e: any) => {
    e.preventDefault();
    setShowSideBar(!showSideBar);
  };

  // Collapse sidebar when settings dialog opens
  useEffect(() => {
    const handler = () => {
      setShowSideBar(false);
      setMobileDrawerOpen(false);
    };
    window.addEventListener("open-settings-dialog", handler);
    return () => window.removeEventListener("open-settings-dialog", handler);
  }, []);

  // Shared profile dropdown
  const ProfileDropdown = ({ collapsed = false }: { collapsed?: boolean }) => (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          {collapsed ? (
            <button className="w-10 h-10 rounded-full bg-primary flex items-center justify-center hover:opacity-90 cursor-pointer transition-opacity duration-200 ">
              <span className="text-sm font-semibold text-primary-foreground">
                {user!.username.charAt(0).toUpperCase()}
              </span>
            </button>
          ) : (
            <button className="flex items-center gap-3 w-full border border-border/60 hover:border-border rounded-xl px-3 py-2.5 transition-all duration-200 group bg-muted/20 hover:bg-muted/40 cursor-pointer shadow-md ">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-primary-foreground">
                  {user!.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-sidebar-foreground truncate capitalize">
                  {user!.username}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="top"
          align={collapsed ? "center" : "end"}
          sideOffset={8}
          className="w-56 rounded-3xl! z-80">
          <DropdownMenuLabel className="font-normal pb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-primary-foreground">
                  {user!.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate capitalize">
                  {user!.username}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user!.email}
                </p>
              </div>
            </div>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() =>
              window.dispatchEvent(new Event("open-settings-dialog"))
            }
            className="cursor-pointer">
            <Settings />
            Settings
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="text-sm text-foreground/70 flex-1">
              Display Mode{" "}
            </span>
            <ThemeToggle />
          </div>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={logout}
            className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <div>
      {/* ── Mobile top bar: hamburger only ── */}
      <header className="fixed top-0 left-0 right-0 z-50 md:hidden flex items-center h-12 px-3 gap-3">
        <button
          onClick={() => setMobileDrawerOpen((v) => !v)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
          aria-label={
            mobileDrawerOpen ? "Close navigation" : "Open navigation"
          }>
          <PanelLeft className="w-5 h-5" />
        </button>
      </header>

      {/* ── Mobile drawer overlay ── */}
      <div
        className={[
          "fixed inset-0 z-60 bg-black/50 backdrop-blur-sm md:hidden",
          "transition-opacity duration-300 ease-in-out",
          mobileDrawerOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={() => setMobileDrawerOpen(false)}
      />

      {/* ── Mobile slide-in drawer ── */}
      <aside
        className={[
          "fixed top-0 left-0 h-full w-72 z-70 md:hidden flex flex-col bg-sidebar border-r border-sidebar-border",
          "transition-transform duration-300 ease-in-out",
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}>
        {/* Drawer header */}
        <div className="flex items-center px-5 py-4 border-b border-sidebar-border">
          <Link
            href="/"
            onClick={() => setMobileDrawerOpen(false)}
            className="flex items-center gap-2">
            <Image
              src={logoLight}
              alt="Clarity"
              height={18}
              className="dark:hidden"
            />
            <Image
              src={logoDark}
              alt="Clarity"
              height={18}
              className="hidden dark:block"
            />
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            const isSpaces = item.label === "Spaces";
            return (
              <div key={item.href}>
                <div className={isSpaces ? "flex items-center" : ""}>
                  <Link
                    href={item.href}
                    className={isSpaces ? "flex-1" : "block"}
                    onClick={() => setMobileDrawerOpen(false)}>
                    <Button
                      variant={isActive ? "active" : "ghost"}
                      className="w-full justify-start gap-3 rounded-[10px]"
                      size="sm">
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Button>
                  </Link>
                  {isSpaces && spaces.length > 0 && (
                    <button
                      onClick={() => setSpacesOpen((o) => !o)}
                      className="p-1 rounded-full hover:bg-primary/30 transition-colors ml-1">
                      {spacesOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>
                  )}
                </div>
                {isSpaces && spacesOpen && spaces.length > 0 && (
                  <div className="ml-6 mt-1 relative">
                    <div className="absolute left-0 top-0 bottom-2 w-px bg-foreground/20" />
                    {spaces.map((space) => {
                      const isSpaceActive = pathname === `/spaces/${space._id}`;
                      return (
                        <div
                          key={space._id}
                          className="relative pl-4 py-0.5 mb-0.5">
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-px bg-foreground/20" />
                          <Link
                            href={`/spaces/${space._id}`}
                            onClick={() => setMobileDrawerOpen(false)}>
                            <span
                              className={`flex items-center gap-1 truncate text-xs py-1 px-2 rounded-[10px] transition-colors ${
                                isSpaceActive
                                  ? "text-foreground font-medium bg-primary/60"
                                  : "text-muted-foreground hover:text-foreground hover:bg-primary/30"
                              }`}>
                              {space.name}
                            </span>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 pb-5 pt-2 border-t border-sidebar-border space-y-2">
          {/* <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.dispatchEvent(new Event("toggle-quick-notes"));
              setMobileDrawerOpen(false);
            }}
            className="w-full justify-start gap-3 group transition-all duration-200 hover:bg-primary/10 rounded-[10px]">
            <StickyNote className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-all duration-200" />
            Quick Notes
          </Button> */}
          {user ? (
            <div onClick={(e) => e.stopPropagation()}>
              <ProfileDropdown />
            </div>
          ) : (
            <Link href="/auth" onClick={() => setMobileDrawerOpen(false)}>
              <Button
                variant="outline"
                className="w-full gap-2 rounded-[10px]"
                size="sm">
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </aside>

      {showSideBar ? (
        <aside className="hidden md:flex w-64 flex-col h-screen border-r border-border bg-sidebar transition-[width,transform] duration-300 ease-in-out">
          {/* Logo */}
          <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-sidebar-border">
            <div
              onClick={() => redirect("/")}
              className="flex items-center gap-2 cursor-pointer">
              <Image
                src={logoLight}
                alt="Clarity"
                height={20}
                className="dark:hidden"
              />
              <Image
                src={logoDark}
                alt="Clarity"
                height={20}
                className="hidden dark:block"
              />
            </div>
            <PanelLeft
              size={16}
              onClick={toggleSidebar}
              className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              const isSpaces = item.label === "Spaces";

              return (
                <div key={item.href}>
                  <div className={isSpaces ? "flex items-center" : ""}>
                    <Link
                      href={item.href}
                      className={isSpaces ? "flex-1" : "block"}>
                      <Button
                        variant={isActive ? "active" : "ghost"}
                        className="w-full justify-start gap-3 my-1 rounded-[10px]"
                        size="sm">
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </Button>
                    </Link>
                    {isSpaces && spaces.length > 0 && (
                      <button
                        onClick={() => setSpacesOpen((o) => !o)}
                        className="p-1 rounded-full hover:bg-primary/30 transition-colors ml-1 mr-1">
                        {spacesOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </div>

                  {isSpaces && spacesOpen && spaces.length > 0 && (
                    <div className="ml-6 mt-1 relative">
                      <div className="absolute left-0 top-0 bottom-2 w-px bg-foreground/20" />
                      {spaces.map((space, idx) => {
                        const isSpaceActive =
                          pathname === `/spaces/${space._id}`;
                        const isLast = idx === spaces.length - 1;
                        const isDragging = dragIndex === idx;
                        const isDropTarget = dragOverIndex === idx;
                        return (
                          <div
                            key={space._id}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragEnter={() => handleDragEnter(idx)}
                            onDragOver={(e) => e.preventDefault()}
                            onDragEnd={handleDragEnd}
                            className={`relative pl-4 py-0.5 mb-0.5 transition-all duration-150 ${
                              isDragging ? "opacity-40" : "opacity-100"
                            } ${
                              isDropTarget ? "border-t-2 border-primary" : ""
                            }`}>
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-px bg-foreground/20" />
                            {isLast && (
                              <div className="absolute left-0 top-1/2 bottom-0 w-px bg-foreground/20" />
                            )}
                            <Link href={`/spaces/${space._id}`}>
                              <span
                                className={`flex items-center gap-1 truncate text-xs py-1 px-2 rounded-[10px] transition-colors cursor-pointer active:cursor-grabbing ${
                                  isSpaceActive
                                    ? "text-foreground font-medium bg-primary/60"
                                    : "text-muted-foreground hover:text-foreground hover:bg-primary/30"
                                }`}>
                                {space.name}
                              </span>
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Quick Notes + Profile footer */}
          <div className="px-4 pb-4 pt-2 border-sidebar-border space-y-2">
            {/* <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                window.dispatchEvent(new Event("toggle-quick-notes"))
              }
              className="w-full justify-start gap-3 group transition-all duration-200 hover:bg-primary/10 rounded-[10px]">
              <StickyNote className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-all duration-200" />
              <span className="text-sm">Quick Notes</span>
            </Button> */}
            {user ? (
              <ProfileDropdown />
            ) : (
              <Link href="/auth">
                <Button
                  variant="outline"
                  className="w-full gap-2 shadow-md rounded-[10px]"
                  size="sm">
                  <LogIn className="w-4 h-4" />
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </aside>
      ) : (
        /* ─── Collapsed sidebar ─── */
        <aside className="hidden md:flex w-16 flex-col h-screen border-r border-border bg-sidebar transition-all duration-300 ease-in-out">
          {/* Logo */}
          <div className="group relative flex h-16 w-full items-center justify-center border-b border-sidebar-border bg-sidebar">
            <Image
              src={logoSmallLight}
              alt="Clarity"
              width={24}
              height={20}
              sizes="84px"
              className="dark:hidden absolute text-primary transition-[opacity,transform] duration-500 ease-in-out opacity-100 scale-100 rotate-0 group-hover:opacity-0 group-hover:scale-75 group-hover:-rotate-90 cursor-pointer"
            />
            <Image
              src={logoSmallDark}
              alt="Clarity"
              width={24}
              height={20}
              sizes="84px"
              className="hidden dark:block absolute text-primary transition-[opacity,transform] duration-500 ease-in-out opacity-100 scale-100 rotate-0 group-hover:opacity-0 group-hover:scale-75 group-hover:-rotate-90 cursor-pointer"
            />
            <PanelLeft
              size={20}
              onClick={toggleSidebar}
              className="absolute transition-all duration-300 ease-in-out opacity-0 scale-75 rotate-90 group-hover:opacity-100 group-hover:scale-100 group-hover:rotate-0 cursor-pointer hover:opacity-80"
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-6 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "active" : "ghost"}
                    className="w-full justify-center my-1 rounded-[10px]"
                    size="sm">
                    <Icon className="w-4 h-4" />
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Quick Notes + Profile footer */}
          <div className="ml-2 px-2 pb-4 pt-2 border-t border-sidebar-border flex flex-col items-center gap-2">
            <button
              title="Quick Notes"
              onClick={() =>
                window.dispatchEvent(new Event("toggle-quick-notes"))
              }
              className="w-10 h-0 flex items-center justify-center rounded-lg text-muted-foreground
                hover:text-primary hover:bg-primary/10 transition-all duration-200 group">
              {/* <StickyNote className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" /> */}
            </button>
            {user ? (
              <ProfileDropdown collapsed />
            ) : (
              <Link href="/auth">
                <Button
                  variant="outline"
                  className="w-full justify-center p-2 rounded-[10px]"
                  size="sm">
                  <LogIn className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
