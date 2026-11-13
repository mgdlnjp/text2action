import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";
import { useDocumentTitle } from "../lib/router";

function Todo({ children }: { children: ReactNode }) {
  return (
    <mark className="rounded bg-amber-soft px-1 font-mono text-[0.85em] text-amber-ink">[À COMPLÉTER : {children}]</mark>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

export function Privacy() {
  useDocumentTitle(
    "Confidentialité — Text2Action",
    "Comment Text2Action traite le texte que vous collez : pas de stockage, pas de journalisation du contenu, fournisseur IA indiqué.",
  );
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="mb-3 text-[12px] font-semibold tracking-[0.1em] text-moss uppercase">Confidentialité</p>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Ce que devient votre texte</h1>

        <div className="mt-8 flex gap-3 rounded-2xl border border-amber-ink/20 bg-amber-soft p-4 text-sm text-amber-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong>Modèle à compléter avant commercialisation.</strong> Cette page décrit le fonctionnement technique
            réel du MVP. Les mentions légales (responsable du traitement, base légale, hébergeur, contact) doivent être
            renseignées et relues par un professionnel avant toute mise en production.
          </p>
        </div>

        <div className="mt-10 space-y-10">
          <Section title="En résumé">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Aucun compte n'est nécessaire.</li>
              <li>Le texte collé n'est enregistré ni dans une base de données ni dans les journaux du serveur.</li>
              <li>Les tâches générées restent uniquement dans l'onglet de votre navigateur, sans stockage local.</li>
              <li>Le paiement est entièrement géré par Stripe : Text2Action ne voit jamais vos coordonnées bancaires.</li>
              <li>Le bouton « Tout effacer » retire immédiatement le texte et le résultat de l'écran.</li>
            </ul>
          </Section>

          <Section title="Traitement du texte">
            <p>
              Lorsque vous lancez une extraction, le texte, le type de source et le contexte facultatif sont envoyés à
              notre serveur via une connexion chiffrée (HTTPS), au maximum 15 000 caractères par demande. Le serveur
              les traite en mémoire pour produire la liste d'actions, puis les oublie.
            </p>
            <p>
              Les journaux techniques ne contiennent que des métadonnées : date, durée, longueur du texte, type de
              source, nombre de tâches et éventuel code d'erreur. Jamais le contenu.
            </p>
          </Section>

          <Section title="Fournisseur d'IA tiers">
            <p>
              <strong>En mode IA</strong>, le texte est transmis à Anthropic (modèles Claude) pour être analysé. Ce
              fournisseur traite les données selon ses propres conditions commerciales et sa politique de conservation.{" "}
              <Todo>préciser la durée de conservation applicable au compte API utilisé, la localisation des données et les garanties contractuelles (DPA)</Todo>
            </p>
            <p>
              <strong>En mode démo</strong>, aucune donnée n'est envoyée à un tiers : l'extraction se fait par règles
              simples sur notre serveur. Le mode actif est toujours affiché dans l'outil.
            </p>
          </Section>

          <Section title="Abonnement et paiement">
            <p>
              L'abonnement Pro est souscrit sur une page de paiement hébergée par <strong>Stripe</strong>, qui collecte
              et traite votre adresse email et vos informations de paiement en tant que prestataire de paiement.
              Text2Action ne reçoit ni ne conserve vos coordonnées bancaires.
            </p>
            <p>
              Après le paiement, un jeton d'accès est enregistré dans le stockage local de votre navigateur. Il contient
              uniquement des identifiants techniques d'abonnement et de client Stripe, signés par notre serveur, et
              permet de vérifier que votre abonnement est actif. Il est supprimé si l'abonnement n'est plus valide.
            </p>
            <p>
              Pour appliquer la limite d'extractions gratuites, l'adresse IP est conservée en mémoire, avec l'heure de
              chaque extraction, pendant 24 heures au maximum, puis effacée. Elle n'est jamais associée au contenu du
              texte.
            </p>
            <p>
              <Todo>préciser la base légale de la facturation, la durée de conservation des factures et la politique de remboursement</Todo>
            </p>
          </Section>

          <Section title="Cookies et mesure d'audience">
            <p>
              Text2Action n'utilise ni cookie, ni traceur, ni outil de mesure d'audience. La page de paiement Stripe,
              hébergée sur le domaine de Stripe, applique sa propre politique de cookies.
            </p>
            <p>
              <Todo>mettre à jour cette section si un outil d'analyse ou de paiement est ajouté</Todo>
            </p>
          </Section>

          <Section title="Responsable du traitement et contact">
            <p>
              Responsable : <Todo>raison sociale, adresse, numéro d'immatriculation</Todo>
            </p>
            <p>
              Contact pour toute question ou exercice de vos droits (accès, rectification, effacement, opposition) :{" "}
              <Todo>adresse email dédiée</Todo>
            </p>
            <p>
              Hébergeur : <Todo>nom, adresse et pays de l'hébergeur</Todo>
            </p>
            <p>
              Base légale du traitement : <Todo>par exemple exécution du service demandé (art. 6.1.b RGPD)</Todo>
            </p>
          </Section>

          <Section title="Recommandations">
            <p>
              Évitez de coller des données sensibles (santé, données bancaires, mots de passe) ou des informations
              confidentielles que votre organisation ne vous autorise pas à transmettre à un service en ligne.
            </p>
          </Section>

          <p className="text-sm text-faint">
            Dernière mise à jour : <Todo>date</Todo>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
