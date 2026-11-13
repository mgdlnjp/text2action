import type { SourceType } from "../../shared/schema";

/** Textes d'exemple fictifs, pour tester l'outil sans coller de données réelles. */
export const SAMPLES: Record<SourceType, string> = {
  email: `Objet : Lancement de la nouvelle offre

Bonjour à tous,

Merci pour vos retours sur la plaquette. Le budget du T3 a été validé par la direction.

Camille, peux-tu envoyer la version finale au client avant vendredi ?
Il faut aussi relancer l'imprimeur pour le devis, c'est urgent.
On pourrait peut-être organiser un webinar de présentation, à voir.

Pour info, la salle du 14 est déjà réservée, c'est fait.

Bonne journée,
Léa`,
  meeting: `Compte rendu — réunion produit du mardi

Présents : Inès, Hugo, Sarah

Décisions :
- La version mobile passe en priorité sur le T2.
- Le tarif "Équipe" reste inchangé.

Actions :
- Hugo : mettre à jour la feuille de route d'ici le 15/04/2026.
- Sarah doit préparer les maquettes de l'onboarding.
- [x] Envoyer le compte rendu aux participants
- Quelqu'un doit contacter le support au sujet des tickets en attente.
- Relancer le prestataire pour l'audit d'accessibilité dès que possible.

Prochaine réunion à fixer.`,
  notes: `notes appel client 10h
- client content de la démo
- il faut envoyer le récap de l'appel
- penser à demander les accès au CRM
- éventuellement prévoir une formation en mai ?
- relancer le récap si pas de réponse sous 1 semaine`,
  other: `Tâches de la semaine :
[ ] Renouveler le nom de domaine
[ ] Répondre au questionnaire fournisseur, pas urgent
[x] Payer la facture d'hébergement
N'oublie pas de sauvegarder la base avant la mise à jour.`,
};
