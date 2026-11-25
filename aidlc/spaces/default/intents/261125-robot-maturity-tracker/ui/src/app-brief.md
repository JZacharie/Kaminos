# Brief: RoboForge, suivi de maturité, impressions 3D, commandes et réparations d'une flotte de robots

## Goal
Build the first clickable frontend of RoboForge, the app a robot maker opens first thing in the morning to see in 10 seconds where each robot stands on its maturity ladder, which 3D prints block it, which components are still to order, what is low in stock and which repairs are open. It must look like a real, polished SaaS product. This brief holds the domain and the screens; the product decisions are asked afterwards by AI-DLC, as questions pinned on the UI. The person wrote the idea in French: all interface text is French.

## The app
Fictional **Atelier Cyclope**, a robotics workshop in Lyon, builds 6 robots with 3 FDM printers (PLA+, PETG, ASA, PA-CF, TPU) and 1 resin printer (résine tough). Each robot has 5 subsystems: Châssis, Mobilité, Énergie, Capteurs, Contrôle, each scored 0-100. The robot score is their mean, rounded. Maturity levels (paliers): P1 Prototype 0-24, P2 Fonctionnel 25-49, P3 Fiable 50-74, P4 Autonome 75-100. The app links five modules: robot sheets and maturity, 3D print queue, orders and supply, stock and "générateur" reserve, repair log and part versions.
Linking rules the UI must make visible:
- Need to action: a part or sub-assembly becomes **Prêt à assembler** only when all its required prints are Validée and all its ordered components are Reçue.
- Repair to maturity: an open critical repair pauses the affected subsystem (its score is frozen) and caps the robot's palier one level lower until the fix is validated.
- Anti-shortage: any withdrawal from the generator buffer stock (reserved for making new parts or robots) raises a "seuil bas" flag as soon as the reserve falls under its minimum.
- An order line is created as soon as a need exceeds the available stock, and it links to the blocked part or repair.
Risks: wrong material breaks a part again; TPU too soft; PETG deforms near motors; a swollen LiPo is critical.

## Users and roles
- **Sarah Connor, lead engineer who orders the stock** (daily): Robots, detail, repairs, Orders, Stock.
- **Hugo Marchand, print and supply technician** (daily): Prints, Orders, Stock.
- **Inès Roche, workshop manager** (weekly): Robots, Orders total, Stock alerts.

## Screens
1. **Robots** `#/robots` (home): 4 KPI cards (robots 6, mean score 45, open critical repairs 2, parts left to print 13); a card per robot with score gauge, palier badge, 5 subsystem bars, next-palier prerequisites and a "paused" ribbon when a critical repair is open; filter by palier; sort by score. Action: open a robot.
2. **Robot detail** `#/robot/R-03`: subsystem bars with frozen ones marked, palier steps P1 to P4, prerequisites to unlock the next palier (each with progress and the linked print, order or repair), sub-assemblies with their status (Prêt à assembler or what blocks it), linked prints, orders and repairs.
3. **Prints** `#/prints`: queue table (id, part, robot, material, priority, g, h, status) with status filter, robot filter, priority sort; summary of what is left to print: 13 parts, 1 833 g, 89 h; status counters. Action: change a print status.
4. **Orders** `#/orders`: table of component orders with the blocked part or repair as a link, status filter, total still to order 195,70 EUR; empty state "Rien à commander".
5. **Stock** `#/stock`: inventory table by category with stock against minimum and a coloured bar, alert list of 5 items under minimum, and the **generator buffer** panel with its minimum line and a withdraw action that shows the "seuil bas" flag.
6. **Repairs** `#/repairs`: repair log (id, date, robot, subsystem, part, anomaly, severity, status) with severity and status filters, and a part-version timeline (v1, v2, v3) per part showing the defect each version fixed; a part that failed twice is flagged "défaut récurrent".

## Mock data
"Now" is **mercredi 25 novembre 2026, 10:00**. Dates dd/mm, 24 h, metric, EUR with comma.

Robots (id, name, type, subsystem scores Châssis/Mobilité/Énergie/Capteurs/Contrôle, score, palier):
- R-01 T-800, bipède, 82/72/78/70/76, score 76, P4
- R-02 T-1000, rover, 70/66/60/58/56, score 62, P3
- R-03 T-X, hexapode, 64/48/52/40/44, score 50, P3 capped to P2 (2 open critical repairs, Mobilité and Énergie frozen)
- R-04 T-800, bras, 52/40/46/30/38, score 41, P2
- R-05 T-1000, suiveur, 40/36/28/22/20, score 29, P2
- R-06 T-X, rover lourd, 18/10/12/5/8, score 11, P1

Prints (id, part, robot, material, priority, g, h, status):
- IM-101 Fémur gauche v3, R-01, PETG, Haute, 142, 6,5, Validée
- IM-102 Fémur droit v3, R-01, PETG, Haute, 142, 6,5, Validée
- IM-103 Pied gauche v2, R-01, PLA+, Moyenne, 88, 4,0, Validée
- IM-104 Plaque dorsale v2, R-01, PLA+, Basse, 64, 3,0, Validée
- IM-105 Tibia avant v2, R-02, PETG, Haute, 55, 2,5, En impression
- IM-106 Crâne et optiques v1, R-02, ASA, Moyenne, 97, 4,5, À préparer
- IM-107 Tibia A v3, R-03, PETG, Haute, 76, 3,5, À réimprimer
- IM-108 Tibia B v3, R-03, PETG, Haute, 76, 3,5, À réimprimer
- IM-109 Tibia C v3, R-03, PETG, Haute, 76, 3,5, En impression
- IM-110 Bassin x6 v2, R-03, PA-CF, Haute, 210, 11,0, À préparer
- IM-111 Mâchoire v2, R-04, résine tough, Moyenne, 24, 2,0, Validée
- IM-112 Épaule rotative v1, R-04, PETG, Basse, 180, 8,0, À préparer
- IM-113 Poignet v1, R-04, résine tough, Haute, 31, 2,8, En impression
- IM-114 Cage thoracique v4, R-05, PLA+, Moyenne, 46, 2,0, Validée
- IM-115 Rotule de genou v2, R-05, TPU, Basse, 12, 1,0, À préparer
- IM-116 Colonne souple v2, R-05, TPU, Moyenne, 30, 2,2, À réimprimer
- IM-117 Cage thoracique v1, R-06, PETG, Haute, 420, 18,0, À préparer
- IM-118 Humérus v1, R-06, PA-CF, Haute, 260, 13,5, À préparer
- IM-119 Crâne v1, R-06, ASA, Moyenne, 310, 15,0, À préparer
- IM-120 Clip câbles v2, R-02, PLA+, Basse, 6, 0,4, Validée
Statuses: Validée 7, En impression 3, À préparer 7, À réimprimer 3.

Orders (id, component, linked need, supplier, total EUR, ETA, status):
- CMD-31 Servos 20 kg x12, IM-110, ElecDirect, 118,80, -, À commander
- CMD-32 Drivers TMC2209 x4, RP-07, ElecDirect, 27,60, 28/11, Commandée
- CMD-33 Vis M3x12 inox x200, IM-117, VisPro, 9,40, 27/11, Expédiée
- CMD-34 Capteurs ToF x3, IM-106, CapteurPlus, 24,30, reçue 24/11, Reçue
- CMD-35 Bobine PA-CF 1 kg, IM-110 et IM-118, FilaMax, 64,90, -, À commander
- CMD-36 PETG noir 1 kg x2, IM-117 et IM-112, FilaMax, 39,80, 27/11, Commandée
- CMD-37 Batterie LiPo 3S x2, RP-05, PowerCell, 41,00, 30/11, Commandée
- CMD-38 Résine tough 1 L, IM-113, ResinLab, 46,50, reçue 24/11, Reçue
- CMD-39 Roulements 608 x10, R-01 maintenance, VisPro, 12,00, -, À commander
- CMD-40 Moteurs NEMA17 x4, IM-118, MotionShop, 52,00, 03/12, Commandée
- CMD-29 Filament PLA+ 1 kg x2, R-01 maintenance, FilaMax, 31,80, reçue 12/11, Reçue
- CMD-30 Connecteurs JST x50, RP-02, ElecDirect, 8,90, reçue 09/11, Reçue
Statuses: À commander 3, Commandée 4, Expédiée 1, Reçue 4 (12 orders).

Stock (article, stock / minimum):
- ST-01 Vis M3x12, 140/100
- ST-02 Vis M4x16, 85/100 (low)
- ST-03 Écrous M3, 310/150
- ST-04 Servos 20 kg, 4/6 (low, need 12)
- ST-05 Moteur NEMA17, 2/2
- ST-06 Driver TMC2209, 1/2 (low)
- ST-07 Capteur ToF, 3/2
- ST-08 IMU MPU6050, 5/2
- ST-09 PETG noir, 2,4 kg/2
- ST-10 PLA+, 3,1 kg/2
- ST-11 PA-CF, 0,3 kg/1 (low)
- ST-12 TPU, 0,8 kg/0,5
- ST-13 Résine tough, 1,2 L/0,5
- ST-14 Buffer filament générique, 3,4 kg/3,0
- ST-15 Buffer servos, 4/4 (at the threshold)
- ST-16 Buffer visserie lot, 220/200
- ST-17 Buffer drivers, 1/2 (seuil bas)
Under minimum: 5 articles (ST-02, ST-04, ST-06, ST-11, ST-17).

Repairs (id, date, robot, subsystem, part, anomaly and fix, severity, status):
- RP-01, 03/11, R-01, Mobilité, Fémur gauche v2, casse de fatigue, v3 +2 mm, Majeure, Clôturée
- RP-02, 06/11, R-01, Châssis, Plaque dorsale v1, clip cassé, v2, Mineure, Clôturée
- RP-03, 10/11, R-02, Mobilité, Tibia avant v1, déformé par la chaleur moteur, v2 PETG, Majeure, À valider
- RP-04, 12/11, R-03, Mobilité, Tibia A v2, rupture à la charnière, v3, Critique, Correctif en cours
- RP-05, 14/11, R-03, Énergie, batterie LiPo, gonflée, CMD-37, Critique, Correctif en cours
- RP-06, 17/11, R-03, Mobilité, Tibia B v2, fissure entre couches, v3, Majeure, Ouverte
- RP-07, 18/11, R-04, Contrôle, Driver TMC2209, grillé, CMD-32, Majeure, Correctif en cours
- RP-08, 19/11, R-04, Mobilité, Mâchoire v1, glisse, v2 résine tough, Mineure, Clôturée
- RP-09, 21/11, R-05, Mobilité, Colonne souple v1, TPU trop souple, v2, Majeure, Ouverte
- RP-10, 23/11, R-02, Capteurs, ToF, parasité par le soleil, CMD-34, Mineure, À valider
- RP-11, 29/10, R-01, Énergie, Connecteur batterie, jeu au branchement, JST remplacé (CMD-30), Mineure, Clôturée
- RP-12, 28/10, R-02, Contrôle, Carte contrôleur, reset intempestif, régulateur 5 V changé, Majeure, Clôturée
Statuses: Clôturée 5, À valider 2, Correctif en cours 3, Ouverte 2 (12 repairs, 7 not closed, 2 critical).
Part versions (part, robot, failures): Tibia A R-03 2 (v1 casse charnière, v2 rupture RP-04, v3 en test); Fémur gauche R-01 2 (v1 fissure, v2 casse RP-01, v3 validée); Tibia avant R-02 1 (v1 déformé RP-03, v2 en impression); Colonne souple R-05 1 (v1 trop souple RP-09, v2 à réimprimer); Mâchoire R-04 1 (v1 glisse RP-08, v2 validée); Plaque dorsale R-01 1 (v1 clip cassé RP-02, v2 validée). "Défaut récurrent" = 2 failures or more: Tibia A and Fémur gauche.

Numbers that must agree: mean score 45; 13 parts to print = 1 833 g, 89 h; 195,70 EUR = the three À commander orders; 5 items under minimum on Stock and its alert list; 2 critical repairs on the Robots KPI and R-03; 7 repairs not closed.

## Decisions that change the UI
- Maturity score: global only, per subsystem, both. Shows or hides subsystem bars.
- Critical repair effect: pause only, lower the score, both. Changes the frozen ribbon and the gauge.
- Print statuses: 4 as listed, add "En file" and "Échec". Changes the filter and counters.
- Print estimate: material only, material and time, plus cost. Adds or removes columns.
- Order trigger: automatic when need exceeds stock, manual, both. Changes the "À commander" badge.
- Order link: part only, part or repair, project. Changes the link column.
- Low-stock alert: below minimum, below minimum plus lead time, none. Changes the alert list.
- Generator buffer: one global reserve, per category. Changes the buffer panel.
- Buffer withdrawal: free, needs a reason, needs approval. Adds a reason field.
- Repair log: simple list, with photos, with cost. Adds columns.
- Part versions: version number only, with change note, with 3D file link. Changes the timeline.
- Recurring defect: flag after 2 failures, 3 failures, none. Changes the badge.
- Users: one person, two roles, per-module rights. Adds a role switcher.

## Quality bar
Looks like a real, polished SaaS product, specific to robotics and 3D printing, in light and dark theme. Use the data above, no lorem ipsum. French text, metric units, 24-hour times, comma decimals. Keyboard accessible, laptop widths (1280 px and up). Charts as inline SVG with titles; tables sortable and filterable. At 1280 to 1440 px: nav on one line; no word broken inside; a card under 480 px wide has at most 3 columns; ids, dates and numbers never wrap; no horizontal scroll.

## Technical constraints
One self-contained page built with the design kit, hash routes in English, no network of any kind (no CDN, web fonts or web images), anchored elements with stable `a-...` ids. Every control a user would try works, including the buffer withdrawal flag.

## Verification
Each screen is reachable; filters and sorting work; R-03 stands out as paused and capped at P2; IM-107 and IM-108 show as À réimprimer; the 3 À commander orders stand out; the 5 items under minimum are listed; the buffer drivers row shows "seuil bas"; dark theme readable; no console errors. Every KPI equals the counts above.
