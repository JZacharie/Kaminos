# Premier écran de RoboForge (version 1)

Index des fichiers de la première version de l'interface. Le contenu de l'interface se trouve dans `ui/prototype.html`.

## Fichiers

- `ui/prototype.html`: page autonome, 397 Ko, 6 écrans, 66 identifiants, thème clair et sombre.
- `ui/ui-map.json`: 29 éléments ancrés, 7 hypothèses.
- `ui/src/`: brief du produit (`app-brief.md`), brief de conception (`brief.json`), jeu de données (`data.js`), écrans (`screens/`).
- `ui/versions/v1/`: copie figée de la version 1.
- `ui/quality/v1.json`: résultat des contrôles de qualité.

## Écrans

| Route | Écran | Action principale |
|---|---|---|
| `#/robots` | Flotte de robots | Ouvrir la fiche d'un robot |
| `#/robot/R-03` | Fiche robot Hexa | Ouvrir la réparation critique |
| `#/prints` | Impressions 3D | Changer le statut d'une impression |
| `#/orders` | Commandes | Passer une commande |
| `#/stock` | Stock | Prélever dans le tampon générateur |
| `#/repairs` | Réparations et versions | Déclarer une réparation |

## Contrôles de qualité

- Contrôles automatiques: console, débordement, accessibilité, réseau, données et Lighthouse passent, sans problème restant.
- Évaluation visuelle: moyenne 4,00 sur 5 (hiérarchie 4, réalisme 5, cohérence 4, lisibilité 3, mise en page 3, adéquation 5).
- Deux remarques non bloquantes: les anneaux de score des cartes de la flotte peuvent s'afficher à 0 avant leur animation, et les cartes de robots sont hautes et de hauteurs inégales.
- Tours de réparation: 0. Qualité: 0 problème bloquant.
- Modèles: concepteur, constructeur de données et constructeurs d'écrans sous Sonnet.
- Brief utilisé: `briefs/custom.md` (11 967 octets), écrit à partir de `briefs/idea.md`.

## Assumptions & Open Questions

- [assumption] Tout le texte de l'interface est en français, parce que l'idée a été écrite en français.
- [assumption] La réponse « tablette » donnée à la question rapide sur l'appareil n'est pas encore prise en compte: la version 1 est pensée pour les portables (1280 px et plus), les mises en page tablette et téléphone existent mais ne sont pas vérifiées.
- [assumption] La réponse « examiner et approuver » à la question rapide sur la tâche principale n'a pas changé l'écran d'ouverture: la version 1 s'ouvre sur la flotte de robots.
- [assumption] Le score d'un robot est la moyenne de ses cinq sous-systèmes, et les paliers sont P1 de 0 à 24, P2 de 25 à 49, P3 de 50 à 74, P4 de 75 à 100 (Q16).
- [assumption] Une réparation critique ouverte fige le sous-système concerné et plafonne le palier d'un niveau (Q4).
- [assumption] Un sous-ensemble passe en Prêt à assembler quand ses impressions sont validées et ses composants reçus (Q15).
- [assumption] Les robots sont triés du score le plus bas au plus haut (Q17), le stock tampon est une réserve globale avec un minimum par ligne (Q18), la file d'impression est un tableau (Q19), les dates sont en jj/mm et 24 h (Q20), l'écran d'ouverture est la flotte de robots (Q14).
- [assumption] Les quantités, noms, prix et fournisseurs sont fictifs (Atelier Cyclope).
