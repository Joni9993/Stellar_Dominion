# STELLAR DOMINION — MVP-Plan & Design-Guideline

*Rundenbasiertes Multiplayer-Strategie-Spiel · Browser/PWA · 2–6 Spieler · self-hosted*
*Sprache: **alle In-Game-Texte auf Englisch** (passt zum Space-Setting). Dieses Dokument bleibt Deutsch als Arbeits-Doc.*

---

## Konzept-Snapshot

Jeder Spieler kommandiert **ein Flaggschiff** einer Alien-Fraktion und reist durch eine Galaxie aus 18 Systemen. Treibstoff ist knapp, Geld verdient man über **Handel**, ausgegeben wird's für **Schiffsteile, Crew und Treibstoff**. Das Schiff baut man in einem **geteilten 3×3-Slot-Gitter** in einer fraktionsspezifischen Schiffskontur (Kampfteile konkurrieren mit Utility um Platz). Der Kern des Spiels sind **Artefakte**: jede Fraktion startet mit einem. Auf der Karte taucht **immer nur EIN „Rumored Artifact" gleichzeitig** auf (Mario-Party-Stern-Prinzip) — ein galaxieweites Gerücht zieht alle Spieler dorthin, man **kauft es vom Schmuggler** und riskiert dabei den Konflikt mit anderen. Erst wenn es geclaimt ist, spawnt das nächste. Zusätzlich nimmt man Artefakte **anderen Spielern im Kampf ab**. Kämpfe laufen als **Echtzeit-Auto-Battler** ab (Build vorab bauen, dann ~10–15 s zuschauen), mit **Schere-Stein-Papier-Konter** zwischen Waffen und Verteidigung. **Sieg:** als Erster X Artefakte besitzen *oder* die meisten nach 20 Zyklen.

Drei Säulen: **KAMPF · HANDEL · ARTEFAKTE**. Alles dreht sich um diese drei.

---
---

# TEIL 1 — MVP-PROGRAMMIERPLAN

## 1.1 Tech-Stack

| Layer | Wahl | Warum |
|---|---|---|
| Sprache | **TypeScript** überall | Geteilte Regel- & Kampf-Logik zwischen Client und Server = ein einziger Determinismus-Code |
| Client-App | **React + Vite** | Viel UI (Karte, Build-Gitter, Shop, Lobby), schnelle Iteration, vibecode-freundlich |
| Rendering | **PixiJS** (WebGL) für Sternenkarte & Kampf-Playback, React/DOM für Panels | Pixel-Sprites, viele bewegte Objekte, nearest-neighbor |
| Client-State | **Zustand** | Leichtgewichtig |
| Server | **Node.js + Colyseus** | Room-basiertes rundenbasiertes Multiplayer, State-Sync, Reconnection, self-hostable |
| Persistenz | **SQLite** (MVP) → Postgres später | Accounts, Match-History |
| PWA | **vite-plugin-pwa** | Installierbar als App |
| Reverse Proxy | **nginx + Certbot** | TLS auf deiner Domain, WebSocket-Proxy |

## 1.2 Architektur

**Monorepo** (pnpm-Workspaces):
```
/shared    → Typen, Spielregeln, Map-Generator, KAMPF-ENGINE (pure functions)
/server    → Colyseus-Rooms, Matchmaking, Intent-Validierung, DB
/client    → React + Pixi, PWA
```
**Authoritative Server.** Clients schicken nur *Intents* (`JUMP`, `TRADE`, `BUILD_CHANGE`, `ATTACK`, `CLAIM_ARTIFACT`, `END_TURN`). Server validiert gegen `/shared`, mutiert State, broadcastet. Kein Cheating möglich.

**Determinismus (kritisch):** Map-Gen und Kampf sind pure, seeded Funktionen. Eigener PRNG (`mulberry32`), **nie** `Math.random()` in Spiel-Logik. Server rechnet den Kampf, schickt das **Event-Timeline-Objekt**, Clients spielen es nur ab.

## 1.3 Datenmodell (Kern)

```ts
type System = {
  id:number; pos:{x:number;y:number}; region:number;
  hasStation:boolean;
  market:{ good:GoodId; buy:number; sell:number; stock:number }[];
  fuelPrice:number; fuelStock:number;
}

type Player = {
  id:string; factionId:FactionId; color:string;
  systemId:number; status:'active'|'crippled';
  credits:number; fuel:number; maxFuel:number;
  cargo:Record<GoodId,number>;
  build:ShipBuild;          // 3×3-Gitter, ÖFFENTLICH einsehbar (kein Fog)
  crew:(CrewId|null)[];     // 2 Plätze vorne (→3 freischaltbar)
  artifacts:string[];       // besessene Artefakte (Siegobjekt)
}

type ShipBuild = { grid:(Part|null)[] }   // genau 9 Slots, Index→Zone

type Part = {
  id:string; type:PartType;               // weapon|shield|armor|pointdef|gen|cap|engine|util|artifact
  damageType?:'laser'|'kinetic'|'missile';// nur Waffen
  defenseType?:'shield'|'armor'|'pointdef';
  zoneAffinity:Zone[]; stats:Partial<Stats>;
  adjacency?:AdjRule[];
}

type Artifact = {
  id:string; name:string; source:'faction'|'rumor';
  ability:{ trigger:'cooldown'|'hpThreshold'|'combatStart'|'onHit'; effect:CombatEffect }
}

type Rumor = {                 // NUR EINS gleichzeitig aktiv
  systemId:number; artifactId:string; price:number; active:boolean;
}

type MatchState = {
  galaxy:Galaxy; players:Player[];
  cycle:number; maxCycles:20;
  rumor:Rumor;                 // aktuelles Rumored Artifact auf der Karte
  rumorPool:string[];          // noch nicht gespawnte neutrale Artefakte
  turnOrder:string[]; activePlayerId:string; phase:'move'|'action';
  winThreshold:number; winnerId?:string;
}
```

**Zonen-Map (3×3):** Reihe oben = **BOW** (Waffen feuern zuerst / +Genauigkeit) · Mitte = **CORE** (Generatoren/Schilde/Artefakte, geschützt) · unten = **STERN** (Antrieb +Ausweichen, Tank +Reichweite). **Crew-Plätze** sitzen separat **vorne an der Schiffsnase**, nicht im 9er-Gitter.

## 1.4 Spielfluss / Zug-Logik

```
Match-Start → generateGalaxy(playerCount, seed) → Spieler auf feste Startsysteme,
              jeder mit Start-Build + Start-Artefakt. Erstes Rumor-Artefakt gespawnt.

Pro Zug des aktiven Spielers:
  1) MOVE  : optional 1 Sprung zum Nachbarsystem (Treibstoff -= laneCost)
  2) ACTION: genau eine von:
       - STATION       : Handeln, Teile/Crew/Treibstoff kaufen, Build ändern
       - ATTACK        : Gegnerschiff im selben System angreifen → Kampf (Sieger nimmt 1 Artefakt)
       - CLAIM_ARTIFACT: Rumored Artifact im selben System kaufen (siehe 1.4b)
  3) END_TURN → nächster Spieler

Nach letztem Spieler: cycle++  (+ Grundeinkommen).  Bei Bedarf neues Rumor spawnen.
Siegprüfung: nach jedem Artefakt-Wechsel (Sofortsieg bei X) und bei cycle==20 (meiste).
```
Build ändern **nur an Stationen**. Verlierer wird `crippled` → springt mit reduzierter Reichweite heim.

## 1.4b Artefakt-Ökonomie — das Rumor-System (Mario-Party-Stern)

Das Herz der Karten-Taktik. **Es ist immer nur ein neutrales Artefakt gleichzeitig im Spiel erreichbar.**

```
- Galaxieweiter RUMOR-Ping (für ALLE sichtbar, kein Fog): "Artifact sighted at <System> (smuggler)".
- Das Artefakt liegt bei einem Schmuggler in einem neutralen System, KAUFPREIS in Credits.
- CLAIM-Regel: aktiver Spieler ist im System UND zahlt den Preis UND ist nicht hostil bedrängt.
- CONTEST: ist ein gegnerischer Spieler im selben System, muss erst gekämpft werden (PvP);
           wer das System danach unbedrängt hält, darf kaufen.
- Ist es geclaimt → Rumor wird still. Zu Beginn des nächsten Zyklus spawnt das nächste
  Rumor-Artefakt aus dem rumorPool, in einer möglichst entfernten Region.
- Preis steigt leicht über die Partie (frühe Artefakte billiger).
```
**Strategische Spannung (genau dein Ziel):** Jeder sieht das Rumor — fliege ich hin (Credits + PvP-Risiko) oder nutze ich die Zyklen, um woanders zu handeln und aufzurüsten und schlage später zu? Wer schon viele Artefakte hat, wird am Rumor-Ort erwartet und gejagt.

**Zweite Quelle:** Artefakte direkt anderen Spielern im **PvP-Kampf** abnehmen (Sieger wählt 1; hat der Verlierer keins → Treibstoff/Modul als Trostbeute).

## 1.5 Kampf-Engine (deterministisch, Tick-Simulation) + Konter

Pure Funktion, identisch auf Server (autoritativ) und Client (Replay).

**Schritt A — `deriveStats(build)`** addiert Basisstats, wendet Zonen-Bonus + Adjazenz an (Generator neben Waffe → −15 % Cooldown; Schild → +Absorb für Nachbarn; Kondensator → Burst), registriert Artefakt-Trigger und Crew-Passive. Ergibt: `hull, shieldMax, shieldRegen, energyPerTick, energyMax, evasion, initiative, weapons[]` (mit `damageType`), `defenses` (shield/armor/pointdef).

**Schritt B — Schere-Stein-Papier-Konter** (Schadensmodifikator):
```
laser   gegen shield  → ×1.5   |  gegen armor   → ×0.6
kinetic gegen armor   → ×1.5   |  gegen shield  → ×0.6
missile → ignoriert shield, voller Hüllenschaden
        ABER: pointdef hat pro Tick Chance, Rakete komplett abzufangen
```
Triangle merkbar: **Laser ▸ Schild ▸ Railgun ▸ Panzer ▸ Laser**, Rakete = Joker, hart gekontert von Punktverteidigung.

**Schritt C — Tick-Loop** (`TICKS_PER_SEC=20`, `MAX_TICKS≈300`):
```
je Tick beide Seiten: energy += gen; shield += regen;
  für jede Waffe (cooldown=0 & energy>=cost):
     energy-=cost; cooldown reset
     hit = rng() < accuracy*(1-gegner.evasion)
     if hit: dmg = base * konterMod(damageType, zielDefense)
             missile? pointdef-Abfangwurf; sonst Schild→Hülle
     timeline.push(...)
  Artefakt-Trigger prüfen → Effekt + timeline.push
  if hull<=0 break
Sieger: hull>0 (Timeout → höherer hull%; Gleichstand → Verteidiger)
return { winnerId, timeline }
```
Client animiert die `timeline`: typisierte Projektile (Laserstrahl / Kinetik-Slug / Rakete mit Trail), Schild-Ripples, Punktverteidigungs-Abfänge, Artefakt-Blitze mit Namensbanner.

**Build-Transparenz:** Da kein Fog, ist jeder Build **einsehbar** (Gegnerschiff auf der Karte antippen → Loadout). So kann man gezielt kontern bauen — das macht das RPS zur Planungsebene, nicht zum Glücksspiel.

## 1.6 Map-Generator (regelbasierte Verteilung)

```
1) 18 Systeme an festen Positionen, Lanes fest (gleiches Skelett jedes Spiel).
2) Galaxie in 4 Regionen.
3) Budget nach Spielerzahl: goodsTypes, fuelDepots, rumorPool-Größe, Preisniveaus.
4) GARANTIEN pro Region: mind. 1 Treibstoffquelle, mind. 1 handelbares Gut (Preisgefälle!).
5) Reststreuung per seeded RNG INNERHALB der Garantien.
6) Startsysteme der Spieler maximal verteilt.
7) Erstes Rumor-Artefakt in der von allen Startpunkten am weitesten entfernten neutralen Region.
```

## 1.7 Multiplayer (Colyseus)
Lobby/Matchmaking (2–6 Slots, Code teilen), GameRoom hält `MatchState`, Intents in `onMessage`, State-Sync per Delta, `allowReconnection` (60 s), optional Turn-Timer (90 s). Kämpfe blockieren nicht — Server rechnet, broadcastet Timeline, alle sehen das Replay.

## 1.8 Deployment
Node-App via pm2/systemd; nginx Reverse Proxy mit TLS (Certbot), `/` → statisches Client-Build, `/ws` → Colyseus (WebSocket-Upgrade durchreichen); Domain A-Record. Client: `vite build` + vite-plugin-pwa → installierbar.

## 1.9 Build-Reihenfolge (Milestones) + MVP-Cut-Line
1. **Fundament:** `/shared` Typen + Regeln; `generateGalaxy` (seeded); Sternenkarte rendern (Pixi).
2. **Solo-Loop (lokal):** Zugstruktur, Sprung+Treibstoff, Station-Shop, **3×3-Build-Editor mit Kontur, Crew-Plätzen, Adjazenz-/Zonen-Stats**.
3. **Kampf-Engine** (`/shared`) inkl. **RPS-Konter** + **Kampf-Playback** (typisierte Effekte). Mit Fix-Builds testen.
4. **Artefakte + Rumor-System:** Rumor-Spawn/Ping, CLAIM-Kauf + Contest, PvP-Loot, Sieg-Check.
5. **Multiplayer:** Colyseus-Rooms, Lobby, Server autoritativ, State-Sync, Kampf serverseitig + Broadcast, Reconnection.
6. **Fraktionen** (6 Kits inkl. Konturen), **Crew**, Balancing-Pass.
7. **PWA + Deploy**, Polish.

**MVP drin:** 2–4 Spieler, 6 Fraktionen, Kernloop, Auto-Battler + RPS, Rumor-System, PvP-Loot, Sieg.
**Später:** Accounts/Ranking, Persistenz, tiefes Crew-System, mehr Teile/Artefakte, Spectator, Sound.

---
---

# TEIL 2 — DESIGN-GUIDELINE

## 2.1 Art Direction
- **NASA-Worm / 80er-Telemetrie** → UI-Sprache: Monospace-Readouts, Gitter-Overlays, Registrierungsmarken, Orange-Rot als Signal.
- **Starbound** → Pixel-Sprites, chunky beveled Panels, gekerbte Ecken.
- **Arc Raiders** → Stimmung: washed-out, gedämpft, hochauflösend. Tiefes Metallblau, Rauchgrau, warme Ocker-/Orange-Akzente. Nie knallbunt.

## 2.2 Palette (verbindlich)
| Token | Hex | Einsatz |
|---|---|---|
| `--void` | `#0c1018` | Weltraum |
| `--panel` | `#161d2a` | Panels |
| `--panel3` | `#243042` | Slots/Buttons |
| `--line` | `#2c3a4d` | Rahmen |
| `--bone` | `#e9e3d4` | Primärtext |
| `--dim` | `#8b96a6` | Sekundärtext |
| `--nasa-red` | `#e8512e` | Signal/Gefahr/Kinetik |
| `--amber` | `#d9a441` | Energie/Credits |
| `--teal` | `#5fa8a4` | Eigene Fraktion/Laser |
| `--green` | `#8a9a5b` | positiv/Mobilität |
| `--purple` | `#8a7caa` | Artefakte/Tech |

## 2.3 Typografie & Pixel-Regeln
`Press Start 2P` (Headers, sparsam) + `VT323` (Body/Telemetrie). `image-rendering:pixelated`, begrenzte Palette + Dithering, 2–3 px Rahmen + Offset-Schatten, gekerbte Ecken, Scanline/Vignette/Grain-Overlay.

## 2.4 Die 6 Fraktionen
Stereotypen bewusst klar (Star-Wars-/Trek-Schule). Jede hat ein Profil über **Kampf / Handel / Artefakte**, ein **Start-Artefakt** das den Stil definiert, und eine **eigene Schiffskontur** (im Builder & Kampf sichtbar).

| Fraktion | Rasse, Look & Kontur | Farbe | Stärke | Schwäche | Start-Artefakt |
|---|---|---|---|---|---|
| **Vol'Kesh Combine** | Reptiloide Händlergilde, opulente vergoldete Frachter, bauchige geschwungene Kontur | `#d9a441` | **Handel** (beste Preise, +Fracht, billiger Treibstoff) | **Kampf** (dünne Hülle) | **Gilded Aegis** — periodische Schildwelle |
| **Korthaar Clans** | Kriegerkaste, brutalistisch gepanzerter Keil, Stachel-Kontur | `#c4513b` | **Kampf** (+Hülle, +Schaden) | **Handel** (miese Preise) | **Wrath Engine** — <50 % Hülle: Feuerrate +50 % |
| **Idryn Concord** | Hochkultur, schlanke Lichtschiffe, serene symmetrische Kontur, leuchtende Kanten | `#5fa8a4` | **Artefakte** (verstärkt Effekte, billig neutral) | mittlere Feuerkraft | **Concord Prism** — +25 % auf alle anderen Artefakte |
| **Nyxari Nomads** | Entdecker, sensorstarrend, schmale Segel/Antennen-Kontur | `#8a9a5b` | **Mobilität** (+Reichweite, billige Sprünge) | kleine Fracht | **Far Sight** — +Ausweichen & First Strike |
| **The Rask** | Schrott-Schwarm, zusammengeflickte asymmetrische Raider-Kontur | `#e8512e` | **Beute** (klaut mehr, Hinterhalt) | fragil, schlechter Ruf | **Boarding Hook** — Gegner <30 %: deaktiviert zufällige Waffe |
| **Vaesh Synod** | Synthetisches KI-Kollektiv, kristalline geometrische Kontur | `#8a7caa` | **Tech** (bessere Generatoren, Advanced-Module) | rigide, teuer | **Overclock Matrix** — nächste 3 Schüsse ignorieren Schild |

## 2.5 Artefakte
Belegen einen **normalen Gitter-Slot**, haben eine **starke aktive Kampf-Fähigkeit**, zählen als **Siegobjekt**. Viele zu haben = mächtig, aber das 9er-Gitter ist eng → weniger Platz für rohe Waffen/Schilde (Selbst-Balancing, bei 3×3 noch schärfer).

**Fraktions-Artefakte:** die 6 oben. **Rumor-Pool (neutrale, je eins gleichzeitig auf der Karte):**
| Name | Trigger | Effekt |
|---|---|---|
| Null Field | Cooldown | hebt Gegnerschild 2 s auf |
| Phase Drive | Cooldown | Chance, eine Salve auszuweichen |
| Siege Battery | passiv | +Schaden gegen Hülle |
| Repair Swarm | passiv | Hülle regeneriert langsam |
| Chrono Capacitor | Kampfstart | erste 3 s Feuerrate +100 % |
| Vampire Array | onHit | heilt Hülle um % des Schadens |

## 2.6 Konter-System (Schere-Stein-Papier)
Damit Builds gegen einander geplant werden — Gegner-Loadout ist einsehbar.
| Angriff | stark gegen (×1.5) | schwach gegen (×0.6) |
|---|---|---|
| **Laser** (Energie, teal) | Schild | Panzer |
| **Railgun** (Kinetik, rot) | Panzer / Hülle | Schild |
| **Rakete** (Sprengkopf) | Hülle (ignoriert Schild) | Punktverteidigung (Abfang) |

Verteidigung: **Schild** (regeneriert; stark vs Railgun) · **Panzer** (flache Reduktion; stark vs Laser) · **Punktverteidigung** (fängt Raketen). Lesbar: Laser ▸ Schild ▸ Railgun ▸ Panzer ▸ Laser; Rakete Joker.

## 2.7 Teile-Katalog (Start-Set) + Zonen/Adjazenz
| Teil | Typ | Schaden/Stat | Beste Zone | Adjazenz |
|---|---|---|---|---|
| Pulse Laser | Waffe·laser | schnell, niedrig, +vs Schild | Bow | + neben Generator |
| Railgun | Waffe·kinetic | langsam, hoch, +vs Panzer | Bow | + neben Kondensator |
| Missile Pod | Waffe·missile | Schild-pierce, begrenzt | Bow | — |
| Shield Projector | Defense·shield | Pool + Regen | Core | gibt Nachbarn +Absorb |
| Armor Plate | Defense·armor | flache Reduktion | Core | — |
| Point-Defense | Defense·pointdef | fängt Raketen | Bow/Core | — |
| Reactor | gen | +Energie/Tick | Core | neben Waffe → Cooldown −15 % |
| Capacitor | cap | +Speicher (Burst) | Core | neben Waffe → Burst |
| Ion Engine | engine | +Ausweichen/Flucht | Stern | — |
| Fuel Tank | util | +Reichweite | Stern | — |
| Cargo Bay | util | +Fracht | beliebig | — |
| ✦ Artefakt | artifact | aktive Kampf-Fähigkeit | Core | — |

**Kern-Spannung (3×3 = nur 9 Slots):** jedes Utility-/Artefakt-Teil ist ein Waffen-/Schild-Slot weniger. Jede Entscheidung tut weh — genau richtig.

## 2.8 Crew (vorne an der Schiffsnase, 2 Plätze → 3)
Auf Stationen anheuern/tauschen, passive Boni (separat vom 9er-Gitter):
**Gunner** +Genauigkeit · **Engineer** +Schildregen · **Smuggler** −1 Treibstoff/Sprung · **Trader** +Verkaufserlös · **Navigator** +Initiative.

## 2.9 UI-Screens (Querformat, alles Englisch)
1. **MAP** — 18 Systeme, Lanes, **alle Spieler sichtbar** (fraktionsfarbene Pfeile + Artefakt-Zähler), **EIN Rumor-Artefakt** mit Ping-Banner oben + ✦-Marker, eigener Reichweiten-Ring. System antippen → Markt/Preise/Sprungkosten + ggf. **CLAIM (Preis)** mit Contest-Warnung. Gegnerschiff antippen → **dessen Build einsehen** (für Konter-Planung).
2. **SHIPYARD** — fraktionsspezifische **Schiffskontur** mit **3×3-Gitter** im Rumpf, **Crew-Plätze an der Nase**, Engine-Glow am Heck. Teile aus Palette setzen, **Adjazenz-Glow + Verbindungslinien**, Live-Stats rechts (HULL/SHIELD/ENERGY/FIRE RATE/RANGE/CARGO).
3. **COMBAT** — beide Schiffe als **Sprites mit sichtbarem Loadout** (Waffen-Hardpoints, Schildkuppel, Artefakte), Balken (HULL/SHIELD/ENERGY), das **~10–15 s Playback** mit typisierten Effekten + **RPS-Callouts** ("LASER ▸ breaks SHIELD") + Artefakt-Banner, dann Beutewahl.

## 2.10 Provisorische Startwerte (zum Balancen)
| Wert | Start |
|---|---|
| Start-Credits | 500 |
| Start-Treibstoff / max | 80 / 100 |
| Grundeinkommen / Zyklus | 50 |
| Sprungkosten | 8–16 (Lane-Distanz) |
| **Gitter** | **3×3 = 9 Slots** |
| Crew-Plätze | 2 (→3) |
| Rumor-Artefakt-Preis | 300, +25 je geclaimtem Artefakt |
| Sieg-Schwelle X | 2 Sp.→3 · 3–4 Sp.→4 · 5–6 Sp.→5 |
| Zyklus-Limit | 20 |
| Konter-Mod | ×1.5 stark / ×0.6 schwach |
| Kampf-Dauer-Cap | ~15 s (300 Ticks @ 20/s) |

---
*Stand: Konzept-Lock v2. Zahlen/Kits provisorisch. Offene Vertiefung: exakte Kampf-Mathematik & Fraktions-Feintuning.*
