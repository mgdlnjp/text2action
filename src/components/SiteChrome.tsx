import { ArrowRight } from "lucide-react";
import { Link } from "../lib/router";
import { Logo, cx } from "./ui";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div
        className={cx(
          "mx-auto flex h-14 items-center justify-between gap-4 px-4 sm:px-6",
          compact ? "max-w-[1400px]" : "max-w-6xl",
        )}
      >
        <Link href="/" aria-label="Text2Action, accueil" className="rounded-md">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm" aria-label="Navigation principale">
          {!compact && (
            <>
              <Link
                href="/#fonctionnement"
                className="hidden rounded-lg px-3 py-2 text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink sm:block"
              >
                Fonctionnement
              </Link>
              <Link
                href="/#faq"
                className="hidden rounded-lg px-3 py-2 text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink sm:block"
              >
                FAQ
              </Link>
            </>
          )}
          <Link
            href="/confidentialite"
            className="rounded-lg px-3 py-2 text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
          >
            Confidentialité
          </Link>
          {!compact && (
            <Link
              href="/app"
              className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-ink px-3.5 font-medium text-paper transition-colors hover:bg-ink-2"
            >
              Ouvrir l'outil
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="max-w-sm">
            Une aide à l'organisation. Les actions proposées doivent être relues avant d'être
            partagées.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Pied de page">
          <Link href="/app" className="hover:text-ink">
            Outil
          </Link>
          <Link href="/#fonctionnement" className="hover:text-ink">
            Fonctionnement
          </Link>
          <Link href="/#faq" className="hover:text-ink">
            FAQ
          </Link>
          <Link href="/confidentialite" className="hover:text-ink">
            Confidentialité
          </Link>
        </nav>
      </div>
    </footer>
  );
}
