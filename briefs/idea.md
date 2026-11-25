Spécifications fonctionnelles clés pour l'application
Pour couvrir l'ensemble de votre cycle de vie robotique (points de maturité, impressions, commandes, réparations et fabrication de nouvelles pièces), l'interface gagne à s'articuler autour de cinq modules reliés :

1. Fiches robots & maturité : chaque robot affiche son score (ex. 0–100 pts ou par sous-système), son palier actuel et les prérequis débloqués pour passer au niveau suivant.

2. File d'impression 3D : liste des pièces à imprimer liée au robot et au point de maturité visé, avec matériau/résine, priorité, estimation matière/temps et statut (À préparer, En impression, Validée, À réimprimer).

3. Commandes & approvisionnement : liste des composants à commander (visserie, moteurs, drivers, capteurs, filaments) déclenchée dès qu'un besoin dépasse le stock disponible, avec lien vers la pièce ou la réparation bloquée.

4. Stock & ressources "générateur" : inventaire des pièces disponibles, des consommables et d'un stock tampon dédié à la fabrication de nouvelles pièces ou de nouveaux robots.

5. Journal de réparation & versions : historique des casses, anomalies et pièces remplacées, relié aux révisions de pièces (v1, v2, v3) pour éviter de reproduire les mêmes défauts.

Règles de liaison recommandées
Dépendance besoin → action : une pièce ou un sous-ensemble passe en Prêt à assembler uniquement lorsque toutes les impressions requises sont validées et que les composants commandés sont réceptionnés.

Impact réparation → maturité : l'ouverture d'une réparation critique met en pause ou abaisse le point de maturité concerné jusqu'à validation du correctif.

Règle anti-rupture : tout prélèvement sur le stock tampon réservé à la création de nouvelles pièces signale un seuil bas dès que la réserve passe sous le minimum défini.