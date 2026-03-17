"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { APISettingsPanel } from "@/components/api-settings-panel";
import { ChatbotPersonalizationPanel } from "@/components/chatbot-personalization-panel";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { User, Palette, Key, Shield, LogOut, Brain, X } from "lucide-react";
import { ThemeColorPicker } from "@/components/theme-color-picker";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const tabs = [
  { id: "account", label: "Account", short: "Account", icon: User },
  { id: "appearance", label: "Appearance", short: "Theme", icon: Palette },
  { id: "api", label: "API Keys", short: "API", icon: Key },
  { id: "ai", label: "Personalisation", short: "AI", icon: Brain },
  { id: "danger", label: "Danger Zone", short: "Danger", icon: Shield },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [active, setActive] = useState("account");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Detect md+ breakpoint
  const [isMd, setIsMd] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsMd(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMd(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Drag-to-dismiss + enter/exit animation state (mobile only) ──
  const [translateY, setTranslateY] = useState("100%");
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startY = useRef(0);
  const currentOffset = useRef(0);

  // Drive enter animation ourselves: start off-screen, slide in after mount
  useEffect(() => {
    if (open && !isMd) {
      setTranslateY("100%");
      setDragOffset(0);
      const raf1 = requestAnimationFrame(() => {
        requestAnimationFrame(() => setTranslateY("0%"));
      });
      return () => cancelAnimationFrame(raf1);
    }
  }, [open, isMd]);

  // Animated close (mobile): slide down then tell parent to close
  const animatedClose = useCallback(() => {
    if (isMd) {
      onOpenChange(false);
      return;
    }
    setTranslateY("100%");
    setTimeout(() => onOpenChange(false), 340);
  }, [onOpenChange, isMd]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      startY.current = e.clientY;
      currentOffset.current = 0;
      setDragging(true);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const dy = e.clientY - startY.current;
      const clamped = dy < 0 ? Math.max(dy * 0.2, -40) : dy;
      currentOffset.current = clamped;
      setDragOffset(clamped);
    },
    [dragging],
  );

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    if (currentOffset.current > 140) {
      animatedClose();
    } else {
      setDragOffset(0);
    }
  }, [dragging, animatedClose]);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_account" }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to delete account.");
        return;
      }
      await logout();
      onOpenChange(false);
      router.push("/auth");
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return null;

  const ActiveIcon = tabs.find((t) => t.id === active)?.icon ?? User;

  const innerContent = (
    <>
      {/* ── Icon tab bar ── */}
      <div className="flex shrink-0 border-b border-border bg-muted/20">
        {tabs.map(({ id, short, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 transition-colors duration-200 border-b-2 -mb-px ${
              active === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="w-4 h-4 shrink-0" />
            <span className="text-[9px] font-medium leading-none">{short}</span>
          </button>
        ))}
      </div>

      {/* ── Content panel ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-5 min-w-0">
        <div className="flex items-center gap-2">
          <ActiveIcon className="w-5 h-5 text-primary shrink-0" />
          <h2 className="text-lg font-semibold text-foreground">
            {tabs.find((t) => t.id === active)?.label}
          </h2>
        </div>

        {/* Account */}
        {active === "account" && (
          <div className="space-y-4">
            <Card className="p-4 md:p-5 border-border bg-card/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-lg md:text-xl font-bold text-primary">
                    {user.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm md:text-base font-semibold text-foreground capitalize truncate">
                    {user.username}
                  </p>
                  <p className="text-xs md:text-sm text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            </Card>
            <Button
              variant="outline"
              className="gap-2 border-border w-full sm:w-auto"
              onClick={logout}>
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          </div>
        )}

        {/* Appearance */}
        {active === "appearance" && (
          <div className="space-y-4">
            <Card className="p-4 md:p-5 border-border bg-card/50">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-medium text-foreground">Display Mode</p>
                  <p className="text-sm text-muted-foreground">
                    Switch between light and dark mode
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </Card>
            <Card className="p-4 md:p-5 border-border bg-card/50">
              <ThemeColorPicker />
            </Card>
          </div>
        )}

        {/* API Keys */}
        {active === "api" && (
          <div className="*:max-w-full [&_input]:text-sm">
            <APISettingsPanel userId={user.id} />
          </div>
        )}

        {/* AI */}
        {active === "ai" && (
          <div className="*:max-w-full">
            <ChatbotPersonalizationPanel userId={user.id} />
          </div>
        )}

        {/* Danger Zone */}
        {active === "danger" && (
          <Card className="p-4 md:p-5 border-destructive/40 bg-card/50">
            <p className="text-sm font-semibold text-destructive mb-1">
              Danger Zone
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Once you delete your account, there is no going back.
            </p>
            {!showDeleteConfirm ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}>
                Delete Account
              </Button>
            ) : (
              <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20 space-y-3">
                <p className="text-sm text-destructive">
                  Are you sure? This cannot be undone.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleting}
                    onClick={handleDeleteAccount}>
                    {deleting ? "Deleting..." : "Confirm Delete"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={deleting}
                    onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </>
  );

  // ── Desktop (md+): sidebar + content layout ─────────────────────────────
  if (isMd) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="p-0 overflow-hidden bg-card border border-border max-w-2xl w-full h-[80vh] flex flex-col z-70 rounded-2xl">
          <DialogTitle className="sr-only">Settings</DialogTitle>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
            <p className="text-base font-semibold text-foreground">Settings</p>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body: sidebar + content */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left sidebar */}
            <nav className="w-48 shrink-0 border-r border-border bg-muted/10 py-3 flex flex-col gap-0.5 px-2">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActive(id)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
                    active === id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </button>
              ))}
            </nav>

            {/* Content panel */}
            <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-5 space-y-5">
              <div className="flex items-center gap-2">
                <ActiveIcon className="w-5 h-5 text-primary shrink-0" />
                <h2 className="text-lg font-semibold text-foreground">
                  {tabs.find((t) => t.id === active)?.label}
                </h2>
              </div>

              {/* Account */}
              {active === "account" && (
                <div className="space-y-4">
                  <Card className="p-4 md:p-5 border-border bg-card/50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-lg md:text-xl font-bold text-primary">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm md:text-base font-semibold text-foreground capitalize truncate">
                          {user.username}
                        </p>
                        <p className="text-xs md:text-sm text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </Card>
                  <Button
                    variant="outline"
                    className="gap-2 border-border"
                    onClick={logout}>
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </Button>
                </div>
              )}

              {/* Appearance */}
              {active === "appearance" && (
                <div className="space-y-4">
                  <Card className="p-4 md:p-5 border-border bg-card/50">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-medium text-foreground">
                          Display Mode
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Switch between light and dark mode
                        </p>
                      </div>
                      <ThemeToggle />
                    </div>
                  </Card>
                  <Card className="p-4 md:p-5 border-border bg-card/50">
                    <ThemeColorPicker />
                  </Card>
                </div>
              )}

              {/* API Keys */}
              {active === "api" && (
                <div className="*:max-w-full [&_input]:text-sm">
                  <APISettingsPanel userId={user.id} />
                </div>
              )}

              {/* AI */}
              {active === "ai" && (
                <div className="*:max-w-full">
                  <ChatbotPersonalizationPanel userId={user.id} />
                </div>
              )}

              {/* Danger Zone */}
              {active === "danger" && (
                <Card className="p-4 md:p-5 border-destructive/40 bg-card/50">
                  <p className="text-sm font-semibold text-destructive mb-1">
                    Danger Zone
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Once you delete your account, there is no going back.
                  </p>
                  {!showDeleteConfirm ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}>
                      Delete Account
                    </Button>
                  ) : (
                    <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20 space-y-3">
                      <p className="text-sm text-destructive">
                        Are you sure? This cannot be undone.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={deleting}
                          onClick={handleDeleteAccount}>
                          {deleting ? "Deleting..." : "Confirm Delete"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deleting}
                          onClick={() => setShowDeleteConfirm(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Mobile: draggable bottom sheet ───────────────────────────────────────
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) animatedClose();
        else onOpenChange(true);
      }}>
      <DialogContent
        className="p-0 overflow-hidden border-0 bg-card left-0! right-0! top-auto! bottom-0! w-full! max-w-none! h-[90dvh]! rounded-t-2xl! flex! flex-col! z-70! translate-x-0! translate-y-0! animate-none!"
        style={{
          transform: `translateY(calc(${translateY} + ${dragOffset}px))`,
          transition: dragging
            ? "none"
            : `transform ${dragOffset > 140 ? "0.3s cubic-bezier(0.4,0,1,1)" : "0.42s cubic-bezier(0.34,1.56,0.64,1)"}`,
          willChange: "transform",
          boxShadow: "0 -8px 40px 0 rgba(0,0,0,0.18)",
        }}>
        <DialogTitle className="sr-only">Settings</DialogTitle>

        {/* ── Drag handle ── */}
        <div
          className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}>
          <div
            className="h-1 rounded-full bg-muted-foreground/30 transition-all duration-150"
            style={{
              opacity: dragging ? 0.7 : 1,
              width: dragging ? "3.5rem" : "2.5rem",
            }}
          />
        </div>

        {innerContent}
      </DialogContent>
    </Dialog>
  );
}
