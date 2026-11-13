import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileDown,
  Flag,
  Mail,
  MousePointerClick,
  NotebookPen,
  ScanText,
  ShieldCheck,
  UserRound,
  Users,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { formatAmount, formatPrice, type BillingConfig } from "../../shared/billing";
import { PRO_FEATURES } from "../features/billing/features";
import { fetchBillingConfig } from "../lib/billing";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { Badge, cx } from "../components/ui";
import { Link, useDocumentTitle } from "../lib/router";

export function Landing() {
  useDocumentTitle(
    "Text2Action — Transformez vos emails et notes en liste d'actions",
    "Collez un email, un compte rendu de réunion ou vos notes : Text2Action en extrait une liste d'actions claire, sans inventer de dates ni de responsables. Export Markdown et CSV.",
  );

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main>
        <Hero />
        <BeforeAfter />
        <HowItWorks />
        <UseCases />
        <Principles />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function PrimaryCta({ children = "Essayer avec mon texte" }: { children?: ReactNode }) {
  return (
    <Link
      href="/app"
      className="group inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-5 text-[15px] font-medium text-paper shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_8px_24px_-10px_rgb(21_20_15/0.6)] transition-colors hover:bg-ink-2"
    >
      {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="grain absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" aria-hidden />
      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
        <p className="animate-rise mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-card/80 px-3 py-1 text-[13px] text-ink-2 shadow-card">
          <ScanText className="size-3.5 text-moss" aria-hidden />
          Du texte brut à la liste d'actions
        </p>
        <h1 className="animate-rise max-w-4xl font-display text-[40px] leading-[1.02] font-semibold tracking-[-0.035em] text-balance [animation-delay:60ms] sm:text-6xl lg:text-7xl">
          Vos emails et comptes rendus, transformés en <span className="mark">liste d'actions</span>.
        </h1>
        <p className="animate-rise mt-6 max-w-2xl text-lg leading-relaxed text-ink-2 [animation-delay:120ms] sm:text-xl">
          Collez un texte. Text2Action repère les demandes, les engagements et les échéances, et cite le passage
          d'où vient chaque tâche. Aucun responsable ni aucune date n'est inventé.
        </p>
        <div className="animate-rise mt-8 flex flex-wrap items-center gap-3 [animation-delay:180ms]">
          <PrimaryCta />
          <Link
            href="/#exemple"
            className="inline-flex h-12 items-center rounded-xl px-4 text-[15px] font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
          >
            Voir un exemple
          </Link>
        </div>
        <ul className="animate-rise mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted [animation-delay:240ms]">
          {["Sans compte", "Texte non stocké", "Export Markdown et CSV"].map((item) => (
            <li key={item} className="flex items-center gap-1.5">
              <Check className="size-3.5 text-moss" strokeWidth={2.5} aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function MiniTask({
  title,
  owner,
  due,
  dueUncertain,
  priority,
  estimated,
  confirm,
  done,
}: {
  title: string;
  owner?: string;
  due?: string;
  dueUncertain?: boolean;
  priority: string;
  estimated?: boolean;
  confirm?: string;
  done?: boolean;
}) {
  return (
    <li className="rounded-xl border border-line bg-card p-3.5 shadow-card">
      <div className="flex gap-3">
        <span
          className={cx(
            "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px]",
            done ? "border-ink bg-ink text-marker" : "border-line-2",
          )}
          aria-hidden
        >
          {done && <Check className="size-3" strokeWidth={3} />}
        </span>
        <div className="min-w-0">
          <p className={cx("text-sm font-semibold", done && "text-faint line-through")}>{title}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {owner ? (
              <Badge icon={<UserRound className="size-3" aria-hidden />}>{owner}</Badge>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-line-2 px-1.5 text-[12px] leading-5 text-faint">
                <UserRound className="size-3" aria-hidden />
                Non précisé
              </span>
            )}
            {due && (
              <Badge tone={dueUncertain ? "amber" : "neutral"} icon={<CalendarDays className="size-3" aria-hidden />}>
                {due}
              </Badge>
            )}
            <Badge tone={priority === "Haute" ? "ink" : "neutral"} icon={<Flag className="size-3" aria-hidden />}>
              {priority}
              {estimated && <span className="font-normal opacity-70"> · estimée</span>}
            </Badge>
          </div>
          {confirm && (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-amber-ink">
              <AlertTriangle className="size-3" aria-hidden />
              À confirmer — {confirm}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function BeforeAfter() {
  return (
    <section id="exemple" className="scroll-mt-20 px-4 pb-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-[28px] border border-line bg-paper-2/60 p-2 shadow-lift">
          <div className="grid gap-2 lg:grid-cols-2">
            <article className="rounded-[22px] bg-card p-5 sm:p-7">
              <header className="mb-5 flex items-center justify-between">
                <span className="text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">Avant · email reçu</span>
                <Mail className="size-4 text-faint" aria-hidden />
              </header>
              <div className="space-y-3 text-[15px] leading-relaxed text-ink-2">
                <p className="text-sm text-muted">Objet : Lancement de la nouvelle offre</p>
                <p>Bonjour à tous,</p>
                <p>
                  Merci pour vos retours sur la plaquette, le budget du T3 a été validé.{" "}
                  <span className="mark text-ink">Camille, peux-tu envoyer la version finale au client avant vendredi ?</span>
                </p>
                <p>
                  <span className="mark text-ink">Il faut aussi relancer l'imprimeur pour le devis, c'est urgent.</span>{" "}
                  <span className="mark text-ink">On pourrait peut-être organiser un webinar</span>, à voir.
                </p>
                <p>
                  Pour info, <span className="mark text-ink">la salle du 14 est déjà réservée</span>, c'est fait.
                </p>
                <p>Bonne journée, Léa</p>
              </div>
            </article>
            <article className="rounded-[22px] bg-paper p-5 sm:p-7">
              <header className="mb-5 flex items-center justify-between">
                <span className="text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">Après · liste d'actions</span>
                <ClipboardList className="size-4 text-faint" aria-hidden />
              </header>
              <ul className="grid gap-2">
                <MiniTask title="Envoyer la version finale au client" owner="Camille" due="avant vendredi" priority="Moyenne" estimated />
                <MiniTask title="Relancer l'imprimeur pour le devis" priority="Haute" />
                <MiniTask title="Organiser un webinar de présentation" priority="Basse" estimated confirm="simple piste évoquée" />
                <MiniTask title="Réserver la salle du 14" priority="Moyenne" estimated done />
              </ul>
              <p className="mt-4 text-[12px] text-muted">
                L'information « budget validé » n'est pas une action : elle n'apparaît pas dans la liste.
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function SectionTitle({ eyebrow, title, intro }: { eyebrow: string; title: ReactNode; intro?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="mb-3 text-[12px] font-semibold tracking-[0.1em] text-moss uppercase">{eyebrow}</p>
      <h2 className="font-display text-3xl leading-tight font-semibold tracking-[-0.025em] text-balance sm:text-4xl">{title}</h2>
      {intro && <p className="mt-4 text-lg leading-relaxed text-ink-2">{intro}</p>}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: MousePointerClick,
      title: "Collez votre texte",
      body: "Un email, un compte rendu, des notes prises à la volée. Indiquez le type de source et, si besoin, un peu de contexte.",
    },
    {
      icon: ScanText,
      title: "Relisez les actions proposées",
      body: "Chaque tâche affiche son extrait source. Les points ambigus sont marqués « à confirmer » plutôt que tranchés à votre place.",
    },
    {
      icon: FileDown,
      title: "Ajustez, cochez, exportez",
      body: "Modifiez un titre, supprimez un doublon, cochez ce qui est fait. Copiez la liste ou exportez-la en Markdown ou en CSV.",
    },
  ];
  return (
    <section id="fonctionnement" className="scroll-mt-20 border-t border-line px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionTitle eyebrow="Fonctionnement" title="Trois étapes, aucune configuration." />
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border border-line bg-card p-6 shadow-card">
              <span className="absolute top-6 right-6 font-mono text-[12px] text-faint">0{i + 1}</span>
              <s.icon className="size-5 text-ink" aria-hidden />
              <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function UseCases() {
  const cases = [
    {
      icon: NotebookPen,
      title: "Transformer des notes en tâches",
      body: "Les notes prises pendant un appel mélangent constats, idées et choses à faire. Text2Action isole les actions, garde les idées au statut de piste à confirmer et laisse de côté les simples informations.",
    },
    {
      icon: Mail,
      title: "Extraire les actions d'un email",
      body: "Dans un long fil, les demandes se cachent entre deux paragraphes. L'outil retrouve qui doit faire quoi quand c'est écrit, recopie l'échéance telle qu'elle figure dans le message, et signale les tâches déjà réalisées.",
    },
    {
      icon: Users,
      title: "Passer d'un compte rendu de réunion à une todo-list",
      body: "Décisions, points d'information et actions se suivent dans un compte rendu. Text2Action ne retient que les actions, fusionne celles qui reviennent plusieurs fois et vous donne une liste prête à partager.",
    },
  ];
  return (
    <section className="border-t border-line bg-card px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionTitle
          eyebrow="Cas d'usage"
          title="Un seul geste pour tous les textes qui contiennent du travail."
          intro="Text2Action s'adapte au type de texte que vous collez, sans modèle à remplir ni règle à écrire."
        />
        <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {cases.map((c) => (
            <article key={c.title}>
              <div className="flex size-10 items-center justify-center rounded-xl bg-marker-soft ring-1 ring-moss/10">
                <c.icon className="size-[18px] text-moss" aria-hidden />
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">{c.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{c.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Principles() {
  const rules = [
    ["Pas de responsable inventé", "Un nom n'est affiché que s'il figure dans le texte. Sinon : « responsable non précisé »."],
    ["Pas de date devinée", "L'échéance est recopiée mot pour mot. Une expression vague reste signalée « à confirmer »."],
    ["Une info n'est pas une tâche", "Les constats et décisions sans suite à donner ne sont pas transformés en actions."],
    ["Une hypothèse n'est pas un engagement", "« On pourrait… » devient au mieux une piste marquée à confirmer."],
    ["Traçable", "Chaque action cite son extrait source pour que vous puissiez la vérifier en un coup d'œil."],
    ["Le texte reste du texte", "Les consignes cachées dans un contenu collé sont ignorées : il est analysé, pas obéi."],
  ];
  return (
    <section className="bg-ink px-4 py-20 text-paper sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="mb-3 text-[12px] font-semibold tracking-[0.1em] text-marker uppercase">Prudent par conception</p>
          <h2 className="font-display text-3xl leading-tight font-semibold tracking-[-0.025em] text-balance sm:text-4xl">
            Mieux vaut une liste courte et juste qu'une liste longue et fausse.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-paper/70">
            Si votre texte ne contient aucune action, Text2Action vous le dit, au lieu de fabriquer une liste pour
            faire bonne figure.
          </p>
        </div>
        <dl className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {rules.map(([title, body]) => (
            <div key={title} className="bg-ink p-6">
              <dt className="flex items-center gap-2 font-semibold">
                <ShieldCheck className="size-4 text-marker" aria-hidden />
                {title}
              </dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-paper/65">{body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Pricing() {
  const [config, setConfig] = useState<BillingConfig | null>(null);
  useEffect(() => {
    fetchBillingConfig()
      .then(setConfig)
      .catch(() => {});
  }, []);
  if (!config?.enabled || !config.price) return null;
  const price = config.price;

  const free = [
    "Essai gratuit, sans inscription",
    "Toutes les fonctionnalités de l'outil",
    "Sans compte, sans carte bancaire",
  ];

  return (
    <section id="tarifs" className="scroll-mt-20 border-t border-line px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionTitle
          eyebrow="Tarifs"
          title="Gratuit pour essayer, illimité quand ça devient un réflexe."
          intro="Pas de compte à créer : l'abonnement est activé sur votre navigateur après le paiement."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl border border-line bg-card p-7 shadow-card">
            <h3 className="font-display text-xl font-semibold tracking-tight">Gratuit</h3>
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-semibold tracking-tight">0 €</span>
            </p>
            <ul className="mt-6 grid gap-2.5">
              {free.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-[15px] text-ink-2">
                  <Check className="size-4 text-moss" strokeWidth={2.5} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/app"
              className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl border border-line font-medium transition-colors hover:border-line-2 hover:bg-paper"
            >
              Commencer gratuitement
            </Link>
          </article>
          <article className="relative rounded-3xl bg-ink p-7 text-paper shadow-lift">
            <span className="absolute top-7 right-7 rounded-full bg-marker px-2.5 py-0.5 text-[12px] font-semibold text-ink">
              Pro
            </span>
            <h3 className="font-display text-xl font-semibold tracking-tight">Illimité</h3>
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-semibold tracking-tight">{formatAmount(price)}</span>
              <span className="text-paper/60">/ {formatPrice(price).split(" / ")[1]}</span>
            </p>
            <ul className="mt-6 grid gap-2.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-[15px] text-paper/85">
                  <Check className="size-4 text-marker" strokeWidth={2.5} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/app"
              className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-marker font-semibold text-ink transition-colors hover:bg-[#c5ea4f]"
            >
              Essayer puis passer à Pro
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <p className="mt-3 text-center text-[12px] text-paper/50">Paiement sécurisé par Stripe</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    {
      q: "Comment transformer un compte rendu de réunion en todo-list ?",
      a: "Ouvrez l'outil, choisissez « Réunion », collez le compte rendu et lancez l'extraction. Vous obtenez une liste de tâches avec leurs responsables et échéances lorsqu'ils sont écrits. Relisez-la, puis exportez-la en Markdown ou en CSV.",
    },
    {
      q: "L'outil peut-il se tromper ?",
      a: "Oui. C'est une aide à l'organisation, pas une vérité. C'est pourquoi chaque tâche cite son extrait source, que les éléments ambigus sont signalés « à confirmer » et que vous pouvez tout modifier avant d'exporter.",
    },
    {
      q: "Mon texte est-il conservé ?",
      a: "Non. Le texte est traité le temps de l'analyse, sans base de données ni journalisation de son contenu. Les tâches restent dans votre onglet et disparaissent quand vous le fermez ou cliquez sur « Tout effacer ». Le détail est dans la page confidentialité.",
    },
    {
      q: "Le texte est-il envoyé à un service d'IA ?",
      a: "En mode IA, oui : le texte est transmis à un fournisseur d'IA tiers pour l'analyse, ce qui est indiqué sous la zone de saisie. En mode démo, l'extraction se fait par règles simples sur notre serveur, sans aucun fournisseur tiers.",
    },
    {
      q: "Quels formats d'export sont disponibles ?",
      a: "Copie dans le presse-papiers (texte simple), fichier Markdown avec cases à cocher, et fichier CSV compatible avec Excel, Google Sheets et la plupart des outils de gestion de projet.",
    },
    {
      q: "Y a-t-il une limite de taille ?",
      a: "Oui, environ 15 000 caractères par analyse, soit un long email ou un compte rendu détaillé. Pour un document plus long, découpez-le en plusieurs parties.",
    },
  ];
  return (
    <section id="faq" className="scroll-mt-20 px-4 py-20 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.4fr]">
        <SectionTitle eyebrow="Questions fréquentes" title="Ce qu'il faut savoir avant de coller votre premier texte." />
        <div className="divide-y divide-line border-y border-line">
          {items.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                <h3 className="text-[16px] leading-snug">{item.q}</h3>
                <span
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-transform duration-200 group-open:rotate-45"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p className="mt-3 pr-10 text-[15px] leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-20 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 rounded-[28px] bg-marker px-6 py-12 sm:px-12 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.025em] text-ink sm:text-4xl">
            Un texte en entrée, une liste en sortie.
          </h2>
          <p className="mt-2 text-lg text-ink/75">Sans inscription. Essayez avec un exemple si vous n'avez rien sous la main.</p>
        </div>
        <PrimaryCta>Ouvrir Text2Action</PrimaryCta>
      </div>
    </section>
  );
}
