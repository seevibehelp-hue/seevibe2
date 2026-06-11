import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";

const App = lazy(() => import("@/App"));

function DeferredApp() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const nativePush = History.prototype.pushState;
    const nativeReplace = History.prototype.replaceState;
    if ((window.history as any).pushState !== nativePush) {
      (window.history as any).pushState = nativePush.bind(window.history);
    }
    if ((window.history as any).replaceState !== nativeReplace) {
      (window.history as any).replaceState = nativeReplace.bind(window.history);
    }
    setReady(true);
  }, []);
  if (!ready) return <div style={{ background: "#000", minHeight: "100vh" }} />;
  return (
    <Suspense fallback={<div style={{ background: "#000", minHeight: "100vh" }} />}>
      <App />
    </Suspense>
  );
}

export const Route = createFileRoute("/$")({
  ssr: false,
  component: () => (
    <ClientOnly fallback={<div style={{ background: "#000", minHeight: "100vh" }} />}>
      <DeferredApp />
    </ClientOnly>
  ),
});
