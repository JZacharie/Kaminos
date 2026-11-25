# Intent Capture Questions

Context: first version of the interface of "RoboForge". Q1-Q3 are the quick questions. The questions that follow are tied to elements of the prototype ([Anchor]:); the ones marked [Kind]: assumption are decisions version 1 already took and can be corrected.

## Sources

- [desc] Initial description: "Answer in Canvas. Read briefs/idea.md: it is the person's own idea in their own words. Write the brief briefs/custom.md from it (same sections as the other briefs) and keep EVERY feature, screen and detail it lists, then build the app described in it."
- [scope] Workflow-selected scope: `ui-workshop`.

## Q1. [Product owner] Who will use this most?
[Kind]: quick

Why we ask: it decides what the first screen shows and how dense it is.

- A. Staff doing daily operational work
- B. Managers who want an overview and numbers
- C. Customers or partners outside the company
- D. Several of these groups about equally
- X. Other (please specify)

[Answer]: A

## Q2. [Product owner] Which device matters most?
[Kind]: quick

Why we ask: it decides the layout (wide tables or stacked cards) and the size of touch targets.

- A. Desktop or laptop
- B. Phone
- C. Tablet
- D. All of them equally
- X. Other (please specify)

[Answer]: C

## Q3. [Product owner] What is the main job of the first version?
[Kind]: quick

Why we ask: it decides which screen opens first and what is on it.

- A. Follow what is happening: lists, status, alerts
- B. Enter or capture data
- C. Review and approve requests
- D. Analyse numbers and trends: dashboards, reports
- X. Other (please specify)

[Answer]: C

## Q4. [Ingénieure en chef] Que fait une réparation critique ouverte sur la maturité d'un robot ?
[Anchor]: a-kpi-critical

Why we ask: Le compteur de réparations critiques et le palier affiché sur chaque fiche robot suivent cette règle.

- A. Elle fige le sous-système concerné
- B. Elle baisse le score de 5 points par réparation
- C. Elle fige le sous-système et plafonne le palier
- D. Aucun effet automatique, alerte seulement
- X. Other (please specify)

[Answer]: D

## Q5. [Responsable atelier] Comment calcule-t-on le score affiché pour toute la flotte ?
[Anchor]: a-kpi-mean-score

Why we ask: Le grand chiffre en tête de l'écran dépend de cette règle.

- A. Moyenne des scores des robots
- B. Sous-système le plus faible de chaque robot
- C. Médiane des scores des robots
- X. Other (please specify)

[Answer]: A

## Q6. [Technicien impression et achats] Quelles impressions comptent comme « à imprimer » ?
[Anchor]: a-kpi-toprint

Why we ask: Le compteur de pièces à imprimer et le reste à imprimer en dépendent.

- A. Tout ce qui n'est pas Validée
- B. À préparer et À réimprimer seulement
- C. À préparer seulement
- X. Other (please specify)

[Answer]: B

## Q7. [Technicien impression et achats] Que montre l'estimation de chaque impression ?
[Anchor]: a-prints-table

Why we ask: La colonne d'estimation de la file change de contenu selon la réponse.

- A. La matière seule
- B. La matière et le temps
- C. La matière, le temps et le coût
- X. Other (please specify)

[Answer]: C

## Q8. [Technicien impression et achats] À quoi une commande est-elle rattachée ?
[Anchor]: a-orders-table

Why we ask: La colonne « Lié à » dit ce que chaque commande débloque.

- A. À une pièce imprimée
- B. À une pièce ou à une réparation
- C. À un robot ou à un projet
- X. Other (please specify)

[Answer]: C

## Q9. [Responsable atelier] Quelles commandes entrent dans le montant à commander ?
[Anchor]: a-kpi-orders-total

Why we ask: Le montant en tête de l'écran des commandes dépend de ce périmètre.

- A. Les lignes À commander seulement
- B. À commander et Commandée
- C. Tout ce qui n'est pas Reçue
- X. Other (please specify)

[Answer]: B

## Q10. [Technicien impression et achats] Quand le stock déclenche-t-il une alerte ?
[Anchor]: a-kpi-stock-low

Why we ask: Le compteur d'articles en alerte et la liste d'alertes suivent cette règle.

- A. Sous le minimum
- B. Sous le minimum plus 20 % de marge
- C. Jamais, un écart dans le tableau suffit
- X. Other (please specify)

[Answer]: A

## Q11. [Responsable atelier] Comment prélève-t-on dans le stock tampon générateur ?
[Anchor]: a-buffer-withdraw

Why we ask: Le libellé et les étapes du bouton de prélèvement changent selon la règle.

- A. Prélèvement libre
- B. Motif obligatoire
- C. Approbation du responsable
- X. Other (please specify)

[Answer]: A

## Q12. [Ingénieure en chef] Que garde-t-on de chaque réparation ?
[Anchor]: a-repairs-table

Why we ask: La colonne d'anomalie du journal s'enrichit selon la réponse.

- A. L'anomalie et le correctif
- B. L'anomalie avec une photo
- C. L'anomalie avec son coût
- X. Other (please specify)

[Answer]: B

## Q13. [Ingénieure en chef] À partir de combien d'échecs une pièce est-elle en défaut récurrent ?
[Anchor]: a-recurring-flag

Why we ask: Le badge de défauts récurrents au-dessus des versions apparaît ou non selon le seuil.

- A. Après 2 échecs
- B. Après 3 échecs
- C. Jamais de badge
- X. Other (please specify)

[Answer]: A

## Q14. [Responsable atelier] Quel écran s'ouvre en premier ?
[Kind]: assumption
[Assumed]: A

Why we ask: Version 1 was built on option A. Change the answer if that decision is wrong.

- A. Flotte de robots
- B. File d'impression
- C. Alertes de stock
- D. Écran selon le rôle
- X. Other (please specify)

[Answer]: A

## Q15. [Ingénieure en chef] Quand un sous-ensemble passe-t-il en Prêt à assembler ?
[Anchor]: a-subassemblies
[Kind]: assumption
[Assumed]: A

Why we ask: La version 1 applique la règle de liaison: toutes les impressions requises validées et tous les composants commandés reçus.

- A. Impressions validées et composants reçus
- B. Impressions validées seulement
- C. Composants reçus seulement
- D. Marquage manuel
- X. Other (please specify)

[Answer]: A

## Q16. [Ingénieure en chef] Les seuils des paliers sont-ils les mêmes pour tous les robots ?
[Anchor]: a-palier-steps
[Kind]: assumption
[Assumed]: A

Why we ask: Version 1 was built on option A. Change the answer if that decision is wrong.

- A. Fixes: 25, 50, 75
- B. Modifiables par robot
- C. Cinq paliers
- D. Un seuil par sous-système
- X. Other (please specify)

[Answer]: B

## Q17. [Responsable atelier] Dans quel ordre les robots s'affichent-ils ?
[Anchor]: a-robot-cards
[Kind]: assumption
[Assumed]: A

Why we ask: Version 1 was built on option A. Change the answer if that decision is wrong.

- A. Score croissant, les plus en retard d'abord
- B. Score décroissant
- C. Numéro de robot
- D. Palier puis nom
- X. Other (please specify)

[Answer]: C

## Q18. [Technicien impression et achats] Le stock tampon est-il une réserve globale ou une par catégorie ?
[Anchor]: a-buffer-panel
[Kind]: assumption
[Assumed]: A

Why we ask: Version 1 was built on option A. Change the answer if that decision is wrong.

- A. Une réserve globale avec un minimum par ligne
- B. Une réserve par catégorie
- C. Une réserve par robot
- D. Un seul minimum global
- X. Other (please specify)

[Answer]: B

## Q19. [Technicien impression et achats] Comment la file d'impression s'affiche-t-elle ?
[Anchor]: a-prints-table
[Kind]: assumption
[Assumed]: A

Why we ask: Version 1 was built on option A. Change the answer if that decision is wrong.

- A. Tableau triable
- B. Kanban par statut
- C. Tableau et kanban
- D. Liste simple
- X. Other (please specify)

[Answer]: C

## Q20. [Responsable atelier] Quel format de date et d'heure utilise-t-on ?
[Kind]: assumption
[Assumed]: A

Why we ask: Version 1 was built on option A. Change the answer if that decision is wrong.

- A. jj/mm et 24 h
- B. jj/mm/aaaa et 24 h
- C. Date relative (il y a 3 j)
- D. Format ISO
- X. Other (please specify)

[Answer]: B

## Q21. [Product owner] Quel problème RoboForge doit-il résoudre en premier ?
[Kind]: stock

Why we ask: cela décide ce que l'intention du projet met en tête et ce que le succès mesure.

- A. Savoir où en est chaque robot sur son échelle de maturité
- B. Ne plus perdre de temps entre impressions, commandes et assemblage
- C. Ne plus reproduire les mêmes défauts de pièces
- D. Éviter les ruptures sur le stock réservé à la fabrication de nouvelles pièces
- E. Pas encore défini
- X. Other (please specify)

[Answer]: A

## Q22. [Product owner] Qui est le client principal de l'application ?
[Kind]: stock

Why we ask: cela décide qui rédige les priorités et pour qui les écrans sont pensés.

- A. L'équipe qui conçoit, imprime et assemble les robots
- B. Un responsable d'atelier qui pilote plusieurs robots
- C. Des clients ou partenaires extérieurs qui reçoivent les robots
- D. Une seule personne, pour son propre projet
- E. Pas encore défini
- X. Other (please specify)

[Answer]: B

## Q23. [Product owner] À quoi verra-t-on que la première version réussit ?
[Kind]: stock

Why we ask: cela fixe les mesures de succès de l'intention.

- A. Aucune pièce n'est attendue sans qu'on sache quelle impression ou quelle commande la bloque
- B. Chaque robot affiche son palier à jour sans calcul à la main
- C. Moins de pièces réimprimées pour le même défaut
- D. Aucun prélèvement sur le stock tampon sans alerte de seuil bas
- E. Pas encore défini
- X. Other (please specify)

[Answer]: A

## Q24. [Product owner] Qu'est-ce qui déclenche ce projet maintenant ?
[Kind]: stock

Why we ask: cela explique pourquoi le projet démarre maintenant et ce qui le rend urgent.

- A. Trop de robots et de pièces pour suivre avec des listes séparées
- B. Des casses répétées de pièces
- C. Des ruptures de composants qui bloquent l'assemblage
- D. Un nouveau robot ou une nouvelle série à fabriquer
- E. Pas encore défini
- X. Other (please specify)

[Answer]: C

## Q25. [Product owner] Qui est concerné par l'application ? (select all that apply)
[Kind]: stock

Why we ask: cela alimente la carte des parties prenantes.

- A. Les personnes qui conçoivent, assemblent et réparent les robots
- B. La personne qui gère les impressions et les achats
- C. Un responsable qui suit l'ensemble
- D. Les fournisseurs de composants et de filaments
- E. Pas encore identifié
- X. Other (please specify)

[Answer]: A, B, C, D

## Q26. [Product owner] Qui décide des paliers, des priorités d'impression et des prélèvements sur le stock tampon ?
[Kind]: stock

Why we ask: cela distingue ceux qui décident de ceux qui influencent.

- A. Une seule personne décide de tout
- B. L'ingénieur décide des paliers, le technicien des impressions et des achats
- C. L'équipe décide ensemble
- D. Un responsable valide les prélèvements sur le stock tampon
- E. Pas encore défini
- X. Other (please specify)

[Answer]: C

## Q27. [Product owner] Quel suivi ou quelle communication faut-il prévoir ?
[Kind]: stock

Why we ask: cela décide s'il faut un rythme de compte rendu ou des alertes.

- A. Aucun suivi formel, on consulte l'application
- B. Un point hebdomadaire sur les paliers et les blocages
- C. Une alerte immédiate pour une réparation critique ou un seuil bas
- D. Un compte rendu mensuel des pièces refaites
- E. Pas applicable
- X. Other (please specify)

[Answer]: C

## Q28. [Product owner] Que la première version ne doit-elle pas faire ?
[Kind]: stock

Why we ask: cela fixe la limite du produit pour cette première version; le plan de travail est déjà choisi.

- A. Piloter directement les imprimantes 3D
- B. Commander automatiquement chez les fournisseurs
- C. Gérer plusieurs ateliers
- D. Stocker les fichiers 3D des pièces
- E. Rien d'exclu pour l'instant
- X. Other (please specify)

[Answer]: A
