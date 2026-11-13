import { ToastProvider } from "./components/Toast";
import { Link, usePathname, useDocumentTitle } from "./lib/router";
import { BillingSuccess } from "./pages/BillingSuccess";
import { Landing } from "./pages/Landing";
import { Privacy } from "./pages/Privacy";
import { Workspace } from "./pages/Workspace";

function NotFound() {
  useDocumentTitle("Page introuvable — Text2Action");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Cette page n'existe pas.</h1>
      <Link href="/" className="rounded-lg px-3 py-2 font-medium underline underline-offset-4 hover:bg-paper-2">
        Revenir à l'accueil
      </Link>
    </main>
  );
}

export function App() {
  const path = usePathname().replace(/\/+$/, "") || "/";
  let page;
  if (path === "/") page = <Landing />;
  else if (path === "/app") page = <Workspace />;
  else if (path === "/confidentialite") page = <Privacy />;
  else if (path === "/abonnement/succes") page = <BillingSuccess />;
  else page = <NotFound />;
  return <ToastProvider>{page}</ToastProvider>;
}
