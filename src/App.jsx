import React from 'react';
import { FolioProvider, useFolio } from './state.jsx';
import { AuthProvider, useAuth } from './auth-context.jsx';
import { supabase } from './lib/supabase.js';
import { TweaksPanel, TweakSection, TweakRadio, TweakButton } from './tweaks-panel.jsx';
import { AuthView } from './auth.jsx';
import { TimerView } from './timer.jsx';
import { CalendarView } from './calendar.jsx';
import { SocietyView, MemberProfileView } from './society.jsx';
import { JournalView } from './journal.jsx';
import { SettingsView } from './settings.jsx';
import { Dock } from './shared.jsx';
import { MockFolioProvider } from './onboarding/MockProvider.jsx';
import { OnboardingTour } from './onboarding/Tour.jsx';

/* App shell — providers, theme injection, router, tweaks */

function ThemeApplier() {
  const f = useFolio();
  React.useEffect(() => {
    const t = f.state.profile.theme;
    const root = document.documentElement;
    if (t === "dark") {
      root.style.setProperty("--bg",        "#1d160f");
      root.style.setProperty("--bg-deep",   "#16110b");
      root.style.setProperty("--surface",   "#28201a");
      root.style.setProperty("--surface-2", "#322820");
      root.style.setProperty("--ink",       "#f0e5d0");
      root.style.setProperty("--ink-2",     "#bda88a");
      root.style.setProperty("--ink-3",     "#8c7c66");
      root.style.setProperty("--ink-4",     "#5e503f");
      root.style.setProperty("--accent",      "#d97a55");
      root.style.setProperty("--accent-deep", "#b85c3c");
      root.style.setProperty("--hm-0", "#2a2117");
      root.style.setProperty("--hm-1", "#4a341f");
      root.style.setProperty("--hm-2", "#7a4e2e");
      root.style.setProperty("--hm-3", "#b06639");
      root.style.setProperty("--hm-4", "#d97a55");
    } else if (t === "light") {
      root.style.setProperty("--bg",        "#faf7f2");
      root.style.setProperty("--bg-deep",   "#f4f0e8");
      root.style.setProperty("--surface",   "#ffffff");
      root.style.setProperty("--surface-2", "#f8f4ec");
      root.style.setProperty("--ink",       "#2a1d12");
      root.style.setProperty("--ink-2",     "#6e5a47");
      root.style.setProperty("--ink-3",     "#9b8978");
      root.style.setProperty("--ink-4",     "#c4b39e");
      root.style.setProperty("--accent",      "#b85c3c");
      root.style.setProperty("--accent-deep", "#8b4423");
      root.style.setProperty("--hm-0", "#f6efe5");
      root.style.setProperty("--hm-1", "#f0d2b0");
      root.style.setProperty("--hm-2", "#e5a87a");
      root.style.setProperty("--hm-3", "#d67d52");
      root.style.setProperty("--hm-4", "#b85c3c");
    } else if (t === "cyan") {
      root.style.setProperty("--bg",        "#e2ecf0");
      root.style.setProperty("--bg-deep",   "#d4e2e8");
      root.style.setProperty("--surface",   "#f1f7fa");
      root.style.setProperty("--surface-2", "#e8f0f4");
      root.style.setProperty("--ink",       "#142932");
      root.style.setProperty("--ink-2",     "#456876");
      root.style.setProperty("--ink-3",     "#7a9aa8");
      root.style.setProperty("--ink-4",     "#b1c6d0");
      root.style.setProperty("--accent",      "#1c8aa3");
      root.style.setProperty("--accent-deep", "#0e6878");
      root.style.setProperty("--hm-0", "#e7f0f4");
      root.style.setProperty("--hm-1", "#b8d5dd");
      root.style.setProperty("--hm-2", "#7eb6c4");
      root.style.setProperty("--hm-3", "#3c93a8");
      root.style.setProperty("--hm-4", "#1c7588");
    } else {
      root.style.setProperty("--bg",        "#f2e6d2");
      root.style.setProperty("--bg-deep",   "#ecdcc4");
      root.style.setProperty("--surface",   "#fbf4e4");
      root.style.setProperty("--surface-2", "#f7ecd6");
      root.style.setProperty("--ink",       "#2a1d12");
      root.style.setProperty("--ink-2",     "#6e5a47");
      root.style.setProperty("--ink-3",     "#9b8978");
      root.style.setProperty("--ink-4",     "#c4b39e");
      root.style.setProperty("--accent",      "#b85c3c");
      root.style.setProperty("--accent-deep", "#8b4423");
      root.style.setProperty("--hm-0", "#f4e8d8");
      root.style.setProperty("--hm-1", "#f0d2b0");
      root.style.setProperty("--hm-2", "#e5a87a");
      root.style.setProperty("--hm-3", "#d67d52");
      root.style.setProperty("--hm-4", "#b85c3c");
    }
  }, [f.state.profile.theme]);
  return null;
}

function BrandLoad() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span className="serif" style={{ fontSize: 28, color: "var(--ink-3)" }}>Folio</span>
    </div>
  );
}

/* AppShell — the actual app UI. Both signed-in mode and onboarding-demo
   mode render this. `page` and `setPage` are controlled by the parent
   (so the tour can advance pages from the outside). */
function AppShell({ page, setPage, showTweaks = true, hideDock = false }) {
  const f = useFolio();
  const [memberUserId, setMemberUserId] = React.useState(null);

  const sessionRunning = !!(f.state.current && !f.state.current.paused);

  let view;
  if (page === "timer") view = <TimerView page={page} setPage={setPage} />;
  else if (page === "calendar") view = <CalendarView />;
  else if (page === "society") view = memberUserId ? <MemberProfileView userId={memberUserId} onBack={() => setMemberUserId(null)} /> : <SocietyView onOpenMember={setMemberUserId} />;
  else if (page === "journal") view = <JournalView />;
  else if (page === "settings") view = <SettingsView />;

  return (
    <>
      {view}
      {!hideDock && (
        <Dock page={page} setPage={(p) => { setPage(p); setMemberUserId(null); }} sessionRunning={sessionRunning} />
      )}

      {showTweaks && (
        <TweaksPanel title="Tweaks">
          <TweakSection title="Navigate">
            <TweakRadio label="Page" value={page}
              options={[
                { value: "timer", label: "Timer" },
                { value: "calendar", label: "Calendar" },
                { value: "society", label: "Society" },
                { value: "journal", label: "Journal" },
                { value: "settings", label: "Settings" },
              ]}
              onChange={(v) => { setPage(v); setMemberUserId(null); }}
            />
          </TweakSection>
          <TweakSection title="Session">
            <TweakButton label={f.state.current ? "End current session" : "Start new session"}
              onClick={() => { f.state.current ? f.actions.endSession() : f.actions.startSession(); }} >
              {f.state.current ? "End" : "Start"}
            </TweakButton>
          </TweakSection>
          <TweakSection title="Theme">
            <TweakRadio label="Theme" value={f.state.profile.theme}
              options={[{ value: "sepia", label: "Sepia" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "cyan", label: "Cyan" }]}
              onChange={(v) => f.actions.setProfile({ theme: v })}
            />
          </TweakSection>
          <TweakSection title="Data">
            <TweakButton label="Reset all data" onClick={() => f.actions.resetAll()}>Reset</TweakButton>
          </TweakSection>
        </TweaksPanel>
      )}
    </>
  );
}

function SignedInApp() {
  const [page, setPage] = React.useState("timer");
  return (
    <AppShell
      page={page}
      setPage={setPage}
    />
  );
}

function OnboardingFlow({ onDone }) {
  const [page, setPage] = React.useState("timer");
  const { user } = useAuth();

  const finish = async () => {
    try {
      await supabase
        .from("profiles")
        .update({ onboarded_at: new Date().toISOString() })
        .eq("user_id", user.id);
    } catch (e) {
      console.error("Failed to mark onboarded:", e);
    }
    onDone();
  };

  return (
    <MockFolioProvider>
      <ThemeApplier />
      <AppShell
        page={page}
        setPage={setPage}
        showTweaks={false}
        hideDock={true}
      />
      <OnboardingTour setPage={setPage} onComplete={finish} onSkip={finish} />
    </MockFolioProvider>
  );
}

function SignedInRouter() {
  // null = checking, true = onboarded, false = needs tour
  const [onboarded, setOnboarded] = React.useState(null);
  const { user } = useAuth();

  React.useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    supabase.from("profiles").select("onboarded_at").eq("user_id", user.id).single().then(({ data, error }) => {
      if (cancelled) return;
      if (error) { console.error(error); setOnboarded(true); return; } // fail open
      setOnboarded(!!data?.onboarded_at);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  if (onboarded === null) return <BrandLoad />;
  if (!onboarded) return <OnboardingFlow onDone={() => setOnboarded(true)} />;

  return (
    <FolioProvider>
      <ThemeApplier />
      <SignedInApp />
    </FolioProvider>
  );
}

function Router() {
  const { session, loading } = useAuth();
  if (loading) return <BrandLoad />;
  if (!session) return <AuthView />;
  return <SignedInRouter />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
