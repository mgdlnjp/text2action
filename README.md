# Text2Action

Micro-SaaS qui transforme un texte brut (email, compte rendu, notes) en **liste d'actions vérifiable**, sans inventer de responsables, de dates ni d'engagements.

- React 19 + Vite + TypeScript + Tailwind CSS v4 + Lucide
- API Express (Node ≥ 20.19), secrets côté serveur uniquement
- Extraction par Claude (`claude-opus-5-5`) avec sortie JSON Schema stricte, ou **mode démo** par règles si aucune clé n'est configurée
- Abonnement Pro via **Stripe Checkout** (facultatif), avec quota gratuit vérifié côté serveur
- Aucun compte, aucune base de données

## Démarrage

```bash
npm install
cp .env.example .env    # facultatif : sans clé, l'app démarre en mode démo
npm run dev             # API sur :8787 + front Vite sur http://localhost:5173
```

| Script | Rôle |
| --- | --- |
| `npm run dev` | API (`tsx watch`) + front Vite avec proxy `/api` |
| `npm test` | Tests Vitest (normalisation, démo, exports, API) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript strict, sans émission |
| `npm run build` | Typecheck, build front (`dist/`) et bundle serveur (`dist-server/`) |
| `npm start` | Production : sert l'API et le front sur `PORT` |

## Configuration (`.env`)

| Variable | Défaut | Description |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | vide | Clé API. Vide : **mode démo**. Jamais exposée au client (pas de préfixe `VITE_`). |
| `AI_MODEL` | `claude-opus-5-5` | Modèle Claude utilisé. |
| `DEMO_MODE` | `false` | Force le mode démo même avec une clé. |
| `PORT` | `8787` | Port HTTP. |
| `MAX_TEXT_CHARS` | `15000` | Taille maximale du texte (borne 500–50 000). |
| `RATE_LIMIT_PER_MINUTE` | `8` | Extractions par IP et par minute. |
| `TRUST_PROXY` | `false` | `true` derrière un reverse proxy, pour lire l'IP réelle. |
| `STRIPE_SECRET_KEY` | vide | Clé secrète Stripe. Vide : facturation désactivée, accès libre. |
| `STRIPE_PRICE_ID` | vide | Prix récurrent du forfait Pro. Le montant affiché est lu chez Stripe. |
| `ACCESS_TOKEN_SECRET` | vide | Secret HMAC des jetons Pro (≥ 32 caractères, obligatoire avec Stripe). |
| `APP_URL` | vide | Origine publique, ex. `https://text2action.fr` (URL de retour Stripe). |
| `FREE_EXTRACTIONS_PER_DAY` | `3` | Extractions gratuites par IP sur 24 h glissantes. |

Le mode actif est exposé par `GET /api/health` et affiché dans l'interface (bandeau « Mode démo » et mention sous la zone de saisie).

## Architecture

```
shared/              Code commun front/serveur
  schema.ts          Types, schéma Zod, JSON Schema envoyé au modèle
  normalize.ts       Validation stricte de la sortie, règles de prudence, déduplication
  export.ts          Copie texte, Markdown, CSV (anti-injection de formules)
  text.ts            Comparaison insensible aux accents et à la casse
server/
  config.ts          Lecture de l'environnement
  validation.ts      Validation et nettoyage de la requête
  rateLimit.ts       Limite de fréquence en mémoire (fenêtre fixe par IP)
  ai/prompt.ts       Prompt système et encapsulation du texte dans <document>
  ai/anthropic.ts    Appel Claude (structured outputs + fallback serveur)
  ai/demo.ts         Extracteur par règles du mode démo
  app.ts             Routes, en-têtes de sécurité, gestion des erreurs, service statique
src/
  pages/             Landing (SEO), Workspace (outil), Privacy (à compléter)
  features/workspace Panneaux source et résultat, carte de tâche, état local
```

**Pipeline d'une extraction :** validation de l'entrée → extracteur (IA ou démo) → JSON brut → `normalizeExtraction` (Zod) → réponse.

La normalisation s'applique **aux deux modes** et sert de seconde barrière, en plus des consignes du prompt :

- un responsable absent du texte ou vague (« quelqu'un », « on »…) est retiré et la tâche est marquée « à confirmer » ;
- une échéance absente du texte est retirée ; une date ISO n'est conservée que si l'année est écrite ; les échéances vagues ne sont jamais confirmées ;
- un extrait source introuvable dans le texte fait passer la confiance à « faible » ;
- les formulations hypothétiques sont signalées ;
- les doublons sont fusionnés en gardant le contexte, et les responsables contradictoires sont signalés ;
- les éléments mal formés sont ignorés avec un avertissement ; une sortie entièrement invalide renvoie une erreur 502 explicite.

**Injection de consignes :** le texte est placé entre balises `<document>` (les balises présentes dans le contenu sont neutralisées), et le prompt système demande de le traiter comme du contenu, jamais comme des instructions.

**Fallback :** l'appel utilise `fallbacks: "default"` (bêta `server-side-fallback-2026-07-01`). Si le modèle décline une requête, l'API la rejoue sur un modèle de repli. Pour le désactiver, retirez `betas` et `fallbacks` dans `server/ai/anthropic.ts`.

## Abonnement (Stripe)

Le fonctionnement reprend celui de RelanceFacture (essais gratuits, puis Stripe Checkout et jeton d'accès sans compte), avec trois renforcements :

| | RelanceFacture | Text2Action |
| --- | --- | --- |
| Quota gratuit | compteur dans le navigateur (contournable) | vérifié par le serveur, par IP, sur 24 h |
| Renouvellement du jeton | identifiant d'abonnement suffisant | ancien jeton **signé** obligatoire, puis abonnement revérifié chez Stripe |
| Résiliation | aucune dans l'app | bouton « Gérer l'abonnement » vers le portail client Stripe |

**Parcours :**
1. L'utilisateur atteint la limite gratuite, ou clique sur « Passer à Pro ».
2. `POST /api/billing/checkout` redirige vers Stripe Checkout.
3. Au retour sur `/abonnement/succes?session_id=…`, `POST /api/billing/activate` vérifie la session chez Stripe et délivre un jeton HMAC (7 jours), stocké dans `localStorage`.
4. Le jeton est envoyé en `Authorization: Bearer` sur `/api/extract`, puis renouvelé automatiquement via `/api/billing/refresh`, qui revérifie l'abonnement chez Stripe.

**Mise en place dans Stripe :**
1. Créez un produit « Text2Action Pro » avec un prix récurrent, puis copiez son `price_…` dans `STRIPE_PRICE_ID`.
2. Activez le **portail client** : Paramètres → Facturation → Portail client. Autorisez au minimum la résiliation et la mise à jour du moyen de paiement.
3. Renseignez `STRIPE_SECRET_KEY`, `ACCESS_TOKEN_SECRET` (`openssl rand -base64 48`) et `APP_URL`.
4. Testez en mode test (`sk_test_…`, carte `4242 4242 4242 4242`) avant de passer en `sk_live_…`.

Aucun webhook n'est nécessaire : l'état de l'abonnement est relu chez Stripe à chaque renouvellement du jeton.

## Confidentialité

- Le texte n'est jamais écrit en base ni dans les logs : seules des métadonnées sont journalisées (longueur, durée, nombre de tâches, code d'erreur). Un test le vérifie.
- `Cache-Control: no-store` sur l'API ; CSP stricte ; aucun cookie ni traceur.
- Le bouton « Tout effacer » vide le texte, le contexte et le résultat, et annule une requête en cours.
- En mode IA, le texte est transmis à Anthropic, ce qui est indiqué dans l'interface, la FAQ et `/confidentialite`.
- **La page `/confidentialite` contient des champs `[À COMPLÉTER]`** (responsable du traitement, hébergeur, DPA, durée de conservation du fournisseur) à remplir avant commercialisation.

## Déploiement

Un seul service Node sert l'API et le front :

```bash
npm ci && npm run build
NODE_ENV=production ANTHROPIC_API_KEY=… TRUST_PROXY=true npm start
```

- **Render / Railway / Fly.io** : build `npm ci && npm run build`, start `npm start`, variables d'environnement dans le tableau de bord, `TRUST_PROXY=true`.
- **HTTPS obligatoire** (fourni par la plateforme ou un reverse proxy).
- Image Docker plus légère : buildez dans une étape séparée, puis copiez `dist/`, `dist-server/` et `package*.json` avant `npm ci --omit=dev`.

## Limites connues du MVP

- **Mode démo :** heuristiques en français, indicatives seulement. Elles ratent des actions formulées sans marqueur (« la salle est à réserver ») et produisent des titres parfois imparfaits.
- **Limite de fréquence en mémoire :** valable pour une seule instance. Avec plusieurs instances, passez par Redis ou par le proxy.
- **Pas de découpage des longs textes :** au-delà de `MAX_TEXT_CHARS`, la requête est refusée.
- **SPA :** le contenu de la landing est rendu côté client (titre, description et `noscript` sont statiques). Pour un SEO optimal, pré-rendez la landing.
- **Abonnement lié au navigateur :** sans compte, l'accès Pro n'existe que sur le navigateur où le paiement a été fait. Effacer les données du site le fait perdre ; il n'y a pas encore de restauration par email.
- **Délai de résiliation :** après une résiliation, l'accès Pro reste actif jusqu'à l'expiration du jeton en cours (7 jours au maximum).
- **Quota par IP :** plusieurs personnes derrière la même IP partagent le quota gratuit, et un changement d'IP le contourne.
- **Dates relatives** (« vendredi ») : affichées telles quelles, jamais converties en date calendaire.
- **Mode IA non testé contre l'API réelle :** les tests utilisent des extracteurs simulés. Faites un essai avec une vraie clé avant la mise en production.
