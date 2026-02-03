# NAND Forge — Tech Spec v1.0

Interactive circuit builder kde jediny built-in gate je NAND. Vsetko ostatne si uzivatel buduje sam a uklada ako znovupouzitelne moduly.

---

## 1. Produkt

### 1.1 Core idea

Uzivatel dostane prazdny canvas a jediny logicky gate — NAND. Z neho postavi NOT, AND, OR, XOR, a kazdy hotovy obvod ulozi ako modul (blok), ktory potom pouziva v dalsich obvodoch. Vznikne hierarchia:

```
NAND → NOT → AND / OR → XOR → Half Adder → Full Adder → 8-bit Adder → ALU → ...
```

### 1.2 MVP scope

| Feature | Popis |
|---|---|
| Canvas | Grid, pan, zoom |
| Komponenty | Input (1-bit), Output (1-bit), NAND (2-input), Constant (0/1), Probe |
| Wiring | Klik-klik prepojenie pinov, manhattan L/Z-shape routing |
| Simulacia | Real-time, event-driven s truth table cache |
| Save as module | Ulozit obvod ako znovupouzitelny blok s definovanym interface (reference-based) |
| Module editing | Editacia existujuceho modulu — zmeny sa propaguju do vsetkych instancii |
| Module library | Panel s ulozenymy modulmi, drag na canvas, klik na otvorenie editacie |
| Rotacia | Moduly aj NAND gate je mozne otacat (0°/90°/180°/270°) |
| Truth table view | Separatny view — vyber modul, zobraz truth table |
| Persistencia | localStorage + JSON export/import |
| Platforma | Desktop browser (Chrome, Firefox, Safari) |

### 1.3 Mimo MVP scope (planovane neskor)

- Multi-bit input/output (4-bit, 8-bit), bus wiring
- Clock source, sekvencne obvody (flip-flopy)
- Vizualne customizovanie blokov (farba, ikona)
- Undo/redo command pattern upgrade (snapshot verzia je v MVP I13)
- Mobile/tablet podpora
- Cloud ukladanie, zdielanie cez URL
- Drill-down — dvojklik na modul otvori jeho vnutro

---

## 2. Architektura

### 2.1 High-level diagram

```
┌─────────────────────────────────────────────────┐
│                    React UI                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Canvas   │  │  Library │  │  Truth Table  │  │
│  │  (editor) │  │  Panel   │  │  View         │  │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │                │           │
│  ┌────┴──────────────┴────────────────┴────────┐ │
│  │              State Manager (Zustand)         │ │
│  └────────────────────┬────────────────────────┘ │
└───────────────────────┼──────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────┐
│              Simulation Engine                    │
│  (cista logika, ziadne React zavislosti)          │
│  ┌──────────────┐  ┌────────────────────────┐    │
│  │  Graph eval   │  │  Truth table generator │    │
│  └──────────────┘  └────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

### 2.2 Princip oddelenia

| Vrstva | Zodpovednost | Zavislosti |
|---|---|---|
| **Simulation Engine** | Evaluacia obvodu, truth table generovanie | Ziadne (pure TS) |
| **State Manager** | Stav grafu, modulov, UI stavu | Zustand, Simulation Engine |
| **React UI** | Rendering, user interakcie | React, State Manager |

Simulation engine nesmie importovat nic z React ani z UI vrstvy. Toto umozni:
- Unit testovanie simulacie bez renderingu
- Buduce zdielanie engine medzi desktop a mobile UI
- Pripadny presun simulacie do Web Workera

---

## 3. Data model

### 3.1 Core typy

```typescript
// === Identifikatory ===
type NodeId = string;   // uuid
type PinId = string;    // uuid
type EdgeId = string;   // uuid
type ModuleId = string; // uuid

// === Pin ===
interface Pin {
  id: PinId;
  name: string;
  direction: "input" | "output";
  bits: 1; // MVP: vzdy 1-bit
}

// === Node na canvase ===
interface CircuitNode {
  id: NodeId;
  type: "input" | "output" | "constant" | "probe" | "module";
  moduleId?: ModuleId;       // ak type === "module", referencia na definiciu
  position: { x: number; y: number };
  rotation: 0 | 90 | 180 | 270;
  pins: Pin[];
}

// === Wire medzi pinmi ===
interface Edge {
  id: EdgeId;
  fromNodeId: NodeId;
  fromPinId: PinId;
  toNodeId: NodeId;
  toPinId: PinId;
}

// === Circuit — editovatelny obvod na canvase ===
interface Circuit {
  id: string;
  name: string;
  nodes: CircuitNode[];
  edges: Edge[];
}

// === Module — ulozeny znovupouzitelny obvod ===
interface Module {
  id: ModuleId;
  name: string;
  inputs: Pin[];               // interface piny (viditelne zvonka)
  outputs: Pin[];              // interface piny (viditelne zvonka)
  circuit: Circuit;            // vnutorna logika (referencna definicia, nie snapshot)
  truthTable?: TruthTable;     // pre-computed, ak inputov <= threshold
  createdAt: string;           // ISO timestamp
  updatedAt: string;           // ISO timestamp poslednej zmeny
}

// === Truth table ===
interface TruthTable {
  inputNames: string[];        // poradie inputov
  outputNames: string[];       // poradie outputov
  rows: Record<string, string>; // "01" -> "1", key = concat input values
}
```

### 3.2 Priklad — XOR modul

```json
{
  "id": "mod-xor-001",
  "name": "XOR",
  "inputs": [
    { "id": "pin-a", "name": "A", "direction": "input", "bits": 1 },
    { "id": "pin-b", "name": "B", "direction": "input", "bits": 1 }
  ],
  "outputs": [
    { "id": "pin-out", "name": "Out", "direction": "output", "bits": 1 }
  ],
  "circuit": {
    "id": "cir-xor-internal",
    "name": "XOR-internal",
    "nodes": [
      { "id": "n1", "type": "nand", "position": { "x": 200, "y": 100 }, "rotation": 0, "pins": ["..."] },
      { "id": "n2", "type": "nand", "position": { "x": 200, "y": 200 }, "rotation": 0, "pins": ["..."] },
      { "id": "n3", "type": "nand", "position": { "x": 350, "y": 100 }, "rotation": 0, "pins": ["..."] },
      { "id": "n4", "type": "nand", "position": { "x": 500, "y": 150 }, "rotation": 0, "pins": ["..."] }
    ],
    "edges": ["...4 NAND gates wired as XOR..."]
  },
  "truthTable": {
    "inputNames": ["A", "B"],
    "outputNames": ["Out"],
    "rows": { "00": "0", "01": "1", "10": "1", "11": "0" }
  },
  "createdAt": "2026-02-02T12:00:00Z"
}
```

### 3.3 Ukladanie

```typescript
// localStorage kluce
"nandforge:modules"  → Module[]      // vsetky ulozene moduly
"nandforge:circuit"  → Circuit       // aktualny rozpracovany obvod
"nandforge:settings" → AppSettings   // user preferences
```

Export/import = download/upload celeho `Module[]` + `Circuit` ako jeden JSON subor.

---

## 4. Simulation engine

### 4.1 Evaluacna strategia

```
Pri zmene inputu:
  1. Zmen hodnotu na input node
  2. Propaguj zmenu cez edges na pripojene nodes
  3. Pre kazdy affected node typu "module":
     a. Ak je to NAND (built-in, specialny moduleId) → evaluuj priamo: !(A && B)
     b. Ak je to modul s truth table → lookup
     c. Ak je to modul bez truth table → rekurzivna simulacia vnutra
  4. Opakuj az kym sa nestabilizuje (max N iteracii pre detekciu infinite loop)
```

NAND je v engine registrovany ako built-in modul s fixnym `moduleId` (napr. `"builtin:nand"`).
Nema interny circuit — engine ho evaluuje priamo cez hardcoded logiku `!(a && b)`.

### 4.2 Truth table cache

| Pocet inputov | Pocet riadkov | Strategia |
|---|---|---|
| 1–16 | 2 – 65 536 | Truth table lookup |
| 17–20 | 131K – 1M | Truth table (volitelne, moze byt pomalsie generovanie) |
| > 20 | > 1M | Rekurzivna simulacia, truth table sa negeneruje |

Truth table sa generuje **pri ulozeni modulu** (nie pri kazdom pouziti). Generovanie prebieha synchronne pre male moduly, pre vacsie cez Web Worker aby sa neblokovalo UI.

### 4.3 Cyklicka validacia

Pri vlozeni modulu do obvodu aj pri wiring-u:
- Skontroluj ci nevznikol cyklus v grafe
- Ak ano → odmietni operaciu, zobraz chybovu hlasku
- Implementacia: DFS cycle detection na directed grafe

> **Poznamka:** toto platí pre MVP (kombinacne obvody). Pre sekvencne obvody (flip-flopy, post-MVP) bude treba podporit kontrolovane cykly s propagation delay modelom.

---

## 5. UI design

### 5.1 Layout

```
┌─────────────────────────────────────────────────────┐
│  Toolbar  [Save Module] [Truth Table] [Export] [Import] │
├────────────┬────────────────────────────────────────┤
│            │                                        │
│  Library   │              Canvas                    │
│  Panel     │                                        │
│            │   ┌─────┐        ┌─────┐               │
│  ┌──────┐  │   │NAND │───────▶│NAND │──▶ [Out]     │
│  │ NAND │  │   └─────┘   ┌──▶└─────┘               │
│  ├──────┤  │   [A] ──────┘                          │
│  │ NOT  │  │   [B] ──────────────────┘              │
│  │ (mod)│  │                                        │
│  ├──────┤  │                                        │
│  │ AND  │  │                                        │
│  │ (mod)│  │                                        │
│  └──────┘  │                                        │
│            │                                        │
├────────────┴────────────────────────────────────────┤
│  Status bar: simulation state, node count           │
└─────────────────────────────────────────────────────┘
```

### 5.2 Interakcie

| Akcia | Chovanie |
|---|---|
| **Drag z library** | Vytvori novy node na canvase |
| **Klik na output pin** → **klik na input pin** | Vytvori wire |
| **Klik na input toggle** | Prepne 0/1, spusti simulaciu |
| **Klik na node** | Selekcia, zobraz properties |
| **R klaves / context menu** | Rotacia vybraneho node (90° CW) |
| **Delete / Backspace** | Zmaz vybrany node alebo wire |
| **Scroll** | Zoom in/out |
| **Stredne tlacidlo drag / Space+drag** | Pan canvas |
| **Save Module button** | Dialog: zadaj meno, oznac interface piny → uloz do library |

### 5.3 Vizual modulov

Vsetky moduly (vratane built-in NAND) maju **jednotny vizual** — obdlznik s menom:

```
        ┌────────┐
  A ──▶ │        │ ──▶ Out
  B ──▶ │  NAND  │
        └────────┘

        ┌────────┐
  A ──▶ │        │ ──▶ Out
  B ──▶ │  XOR   │
        └────────┘
```

- Meno modulu v strede
- Input piny vlavo, output piny vpravo
- Poradie pinov zhora nadol podla poradia v akom boli vytvorene v povodnom obvode
- Pri rotacii sa piny presuvaju na zodpovedajuce strany
- NAND vizualne nevynika — je modul ako kazdy iny, len je built-in a nemazatelny

### 5.4 Truth table view

Separatny modal/panel:
- User vyberie modul z library
- Zobrazi sa tabulka so vsetkymi kombinaciami vstupov a zodpovedajucimi vystupmi
- Pre > 256 riadkov: stránkovanie alebo virtualizovany scroll
- Moznost triedit/filtrovat podla konkretneho outputu

---

## 6. Manhattan wiring (L/Z-shape)

### 6.1 MVP algoritmus

```
Given: sourcePin (x1, y1), targetPin (x2, y2)

1. Z output pinu chod horizontalne doprava o OFFSET (napr. 20px)
2. Z input pinu chod horizontalne dolava o OFFSET
3. Spoj tieto dva body vertikalnym segmentom

Vysledok: 3-segmentovy Z-shape path
  source ──── ┐
              │
              └──── target
```

### 6.2 Pravidla

- Wiry sa kreslia s malym padding od pinov (nelepia sa na hranu node)
- Ak su piny v rovnakej vyske → rovny horizontalny wire (2 segmenty stacia)
- Wire hover → highlight pre identifikaciu
- Klik na wire → selekcia (pre mazanie)

### 6.3 Buduci upgrade (post-MVP)

- Pathfinding okolo komponentov (A* na gridu)
- Auto-spacing paralelnych wirov
- Wire bundling pre bus signaly

---

## 7. Tech stack

| Technologia | Ucel |
|---|---|
| **React 18+** | UI framework |
| **TypeScript** | Typova bezpecnost |
| **Zustand** | State management |
| **React Flow** | Node-based canvas (drag/drop, pan/zoom, edges) — vyhodnotit ci vyhovuje, alternativa: vlastny SVG |
| **Vite** | Build tool |
| **Vitest** | Unit testy (hlavne simulation engine) |
| **Tailwind CSS** | Styling |

### 7.1 React Flow — validacia pre NAND Forge

React Flow poskytuje:
- Node rendering, drag & drop, pan, zoom — zadarmo
- Edge rendering — treba customizovat na manhattan routing
- Minimap, controls — bonus

Overene:

**1. Custom pin positions — OK**
React Flow podporuje lubovolny pocet Handle komponentov na jednom node. Kazdy handle
moze mat unikatne `id` a poziciovat sa cez CSS (`top`, `left`, `transform`).
NAND gate s 2 input + 1 output pinmi je plne podporovany.

```tsx
// Priklad: NAND gate s 2 inputmi vlavo, 1 outputom vpravo
<Handle type="target" position={Position.Left} id="in-a" style={{ top: '30%' }} />
<Handle type="target" position={Position.Left} id="in-b" style={{ top: '70%' }} />
<Handle type="source" position={Position.Right} id="out" style={{ top: '50%' }} />
```

Obmedzenie: nepouzivat `display: none` na handles — React Flow potrebuje vypocitat
rozmery. Pouzit `visibility: hidden` alebo `opacity: 0` ak treba skryt.

**2. Manhattan edge routing — OK**
Custom edge komponenty dostavaju `sourceX`, `sourceY`, `targetX`, `targetY` a mozu
renderovat lubovolny SVG path. Manhattan routing = rucne zostaveny path z `M`, `L` segmentov.

```tsx
function ManhattanEdge({ sourceX, sourceY, targetX, targetY, id }: EdgeProps) {
  const midX = (sourceX + targetX) / 2;
  const path = `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
  return <BaseEdge id={id} path={path} />;
}
```

**3. Performance pri 100+ nodoch — OK s disciplinou**
Pokryte v sekcii 7.2. Pri dodrzani pravidiel P1–P5 je 100+ nodov zvladnutelnych na 60 FPS.

**Verdikt: React Flow je potvrdeny ako primarny framework. Fallback na vlastny SVG nie je potrebny.**

### 7.2 React Flow — performance pravidla

React Flow je vykonnostne citlivy na nespravne pouzitie. Podla auditu (Synergy Codes, 2025)
jedna neoptimalizovana anonymna funkcia (`onNodeClick={() => {}}`) sposobi pri 100 nodoch
pad z 60 FPS na 10 FPS (jednoduche nody) resp. 2 FPS (tazke nody). Nasledujuce pravidla
su **povinne** od prveho riadku kodu:

#### P1: Memoizacia props na `<ReactFlow>`

- Vsetky **objekty** (defaultEdgeOptions, snapGrid, nodeTypes, edgeTypes) definovat
  mimo komponent alebo cez `useMemo` so stabilnymi dependencies
- Vsetky **funkcie** (onNodeClick, onConnect, onNodesChange...) cez `useCallback`
  so stabilnymi dependencies
- `nodeTypes` a `edgeTypes` **musia** byt definovane mimo renderovaci komponent
  (inak React Flow vytvori novu mapu pri kazdom renderi)

```tsx
// SPRAVNE — mimo komponent
const nodeTypes = { input: InputNode, output: OutputNode, constant: ConstantNode, probe: ProbeNode, module: ModuleNode };
const edgeTypes = { manhattan: ManhattanEdge };

function CircuitCanvas() {
  const onConnect = useCallback((params) => { /* ... */ }, []);
  return <ReactFlow nodeTypes={nodeTypes} edgeTypes={edgeTypes} onConnect={onConnect} />;
}
```

#### P2: Custom nody a edges vzdy do `React.memo`

Kazdy custom node (`NandNode`, `InputNode`, `OutputNode`, `ModuleNode`) a custom edge
(`ManhattanEdge`) **musi** byt wrappnuty v `React.memo`. Toto je najefektivnejsia
single optimalizacia — aj pri rozbitej memoizacii rodica zachrani FPS z 10 na 50-60.

```tsx
const NandNode = React.memo(({ data, id }: NodeProps) => {
  // ... render
});
```

#### P3: Nikdy nezavisiet priamo na nodes/edges poli

Toto je najcastejsia performance past v React Flow. Pole `nodes` a `edges` sa meni
pri **kazdom** drag ticku, pane, zoome.

```tsx
// ZLE — rerender pri kazdom pohybe lubovolneho nodu
const selectedNodes = useStore(state => state.nodes.filter(n => n.selected));

// SPRAVNE — separatny stav aktualizovany len cez onSelectionChange
const selectedNodeIds = useCircuitStore(state => state.selectedNodeIds);
```

Pravidlo: ak potrebujes odvodeny stav z nodes/edges, drzat ho v **separatnom poli**
v Zustand store a aktualizovat ho len ked sa skutocne zmeni (cez React Flow callbacky).

#### P4: Zustand selektory — shallow comparison

Pri citani viacerych hodnot zo store nepouzivat array return bez `useShallow`:

```tsx
// ZLE — novy array pri kazdom state change
const [a, b] = useStore(state => [state.a, state.b]);

// SPRAVNE — shallow comparison
import { useShallow } from 'zustand/react/shallow';
const [a, b] = useStore(useShallow(state => [state.a, state.b]));
```

Alternativa: pouzit `createWithEqualityFn` so `shallow` comparison globalne pre cely store.

#### P5: Progressive rendering pre velke obvody

Pre obvody s 200+ nodmi zvazit:
- `hidden` property na nodoch mimo viewport
- Virtualizaciu — renderovat len viditelne nody
- Web Worker pre simulaciu aby sa neblokoval UI thread

---

## 8. Struktura projektu

```
nand-forge/
├── src/
│   ├── engine/                  # Simulation engine (pure TS, no React)
│   │   ├── types.ts             # Core data typy (Circuit, Module, Pin, Edge...)
│   │   ├── simulate.ts          # Event-driven evaluacia
│   │   ├── truth-table.ts       # Generovanie truth tables
│   │   └── validate.ts          # Cycle detection, validacia
│   │
│   ├── store/                   # Zustand stores
│   │   ├── circuit-store.ts     # Aktualny obvod (nodes, edges)
│   │   ├── module-store.ts      # Kniznica ulozenych modulov
│   │   └── simulation-store.ts  # Stav simulacie (wire values)
│   │
│   ├── components/              # React komponenty
│   │   ├── Canvas/              # Hlavny editor canvas
│   │   │   ├── Canvas.tsx
│   │   │   ├── ModuleNode.tsx   # Univerzalny vizual pre vsetky moduly (NAND, user-created)
│   │   │   ├── InputNode.tsx    # Input toggle
│   │   │   ├── OutputNode.tsx   # Output indikator
│   │   │   ├── ConstantNode.tsx # Constant 0/1
│   │   │   ├── ProbeNode.tsx    # Debug probe
│   │   │   └── ManhattanEdge.tsx # Custom edge routing
│   │   │
│   │   ├── Library/             # Panel s modulmi
│   │   │   ├── LibraryPanel.tsx
│   │   │   └── ModuleCard.tsx
│   │   │
│   │   ├── TruthTable/          # Truth table view
│   │   │   └── TruthTableView.tsx
│   │   │
│   │   ├── Toolbar/             # Horny toolbar
│   │   │   └── Toolbar.tsx
│   │   │
│   │   └── SaveModule/          # Dialog pre ukladanie modulu
│   │       └── SaveModuleDialog.tsx
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useSimulation.ts     # Prepojenie engine ↔ React
│   │   └── useWiring.ts        # Wiring interaction logic
│   │
│   ├── utils/                   # Helpers
│   │   ├── persistence.ts       # localStorage + JSON export/import
│   │   └── layout.ts           # Pin pozicie, rotacia
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── tests/
│   ├── engine/                  # Unit testy pre engine
│   │   ├── simulate.test.ts
│   │   ├── truth-table.test.ts
│   │   └── validate.test.ts
│   └── components/              # Component testy
│
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

---

## 9. Canvas model

Canvas je vzdy viazany na konkretny modul. Neexistuje "volny canvas" — user vzdy
pracuje na pomenovanom module.

### 9.1 Workflow

**Vytvorenie noveho modulu:**
1. User klikne **"New Module"**
2. Zada **nazov** modulu (napr. "XOR")
3. Canvas sa vycisti — prazdna plocha s nazvom modulu v hlavicke
4. User pridava Input/Output nody, NAND gates, existujuce moduly z kniznice, spaja ich
5. Priebezne sa autosave-uje do localStorage

**Editacia existujuceho modulu:**
1. User klikne na modul v kniznici (napr. "AND")
2. Canvas sa prepne — nacita sa vnutorna logika modulu
3. User edituje
4. Priebezne sa autosave-uje

**Ulozenie (Save):**
1. User klikne **"Save"** (alebo Ctrl+S)
2. Aktualny canvas sa ulozi ako definicia modulu
3. Vsetky Input/Output nody sa stanu interface pinmi — **vzdy**, aj ked nie su interne pripojene
4. Mena pinov sa preberaju z nazvov Input/Output nodov na canvase (editovatelne priamo na node)
5. Ak inputov ≤ 16 → truth table sa (pre)generuje
6. Modul sa aktualizuje v kniznici a localStorage

### 9.2 Editacia pouziteho modulu

Moduly su **reference-based** — kazda instancia modulu v inom obvode odkazuje na jedinu
definiciu. Zmena modulu sa propaguje do vsetkych miest kde je pouzity.

**Pri ulozeni sa porovnava interface (piny) s predchodzou verziou:**

| Typ zmeny | Správanie |
|---|---|
| **Len vnutorna logika** (rovnake piny, iny wiring) | Tiche ulozenie. Vsetky instancie pouzivaju novu logiku. Truth table sa pregeneruje. |
| **Premenovanie pinu** | Tiche ulozenie. Premenovanie je kozmeticke — wiry su viazane na pin ID, nie meno. |
| **Pridanie noveho pinu** | Tiche ulozenie. Novy pin je v rodicovskych moduloch viditelny ale nepripojeny. |
| **Odobranie pinu** | **Warning dialog**: "Pin X je pripojeny v moduloch Y, Z. Odobranim sa odpoja wiry." → Ulozit / Zrusit |
| **Odobranie + "Ulozit"** | Wiry na neexistujuce piny sa **odpoja** v rodicovskych moduloch. Rodicovsky modul sa stane vizualne "rozbity" (viditelne odpojene wiry). |

**Mazanie modulu:**
- Ak modul **nie je pouzity** nikde → zmaze sa bez dialogu
- Ak modul **je pouzity** v inych moduloch → **warning dialog**: "Modul X je pouzity
  v moduloch Y, Z. Zmazanim sa odstrani zo vsetkych obvodov a odpoja sa wiry." → Zmazat / Zrusit
- Po potvrdeni: vsetky instancie modulu sa odstania z rodicovskych obvodov, pripojene
  wiry sa odpoja, truth tables rodicovskych modulov sa pregeneruju

**Kaskadova aktualizacia:**
Pri ulozeni modulu A ktory je pouzity v module B ktory je pouzity v module C:
1. Aktualizuje sa definicia A
2. Pregeneruje sa truth table A
3. Pregeneruju sa truth tables vsetkych modulov ktore A pouzivaju (B, potom C)

### 9.3 Prepinanie medzi modulmi

- Ak ma user neulozenene zmeny a prepne na iny modul → **dialog "Unsaved changes"**
  (Save / Discard / Cancel)
- Pri spusteni appky sa otvori posledny editovany modul

### 9.4 Validacia pri ukladani

- Musi mat aspon 1 input a 1 output node
- Nepripojene Input/Output piny → **warning** ("Pin X nie je pripojeny k ziadnemu gate"), nie error
- Nazov nesmie byt "NAND" (reserved)
- Modul nemoze obsahovat sam seba (ani tranzitivne)

---

## 11. Rotacia

### 11.1 Pravidla

Kazdy node ma property `rotation: 0 | 90 | 180 | 270`.

| Rotacia | Input piny | Output piny |
|---|---|---|
| 0° (default) | vlavo | vpravo |
| 90° | hore | dole |
| 180° | vpravo | vlavo |
| 270° | dole | hore |

### 11.2 Interakcia

- Selektuj node → stlac `R` → rotacia +90° CW
- Context menu → "Rotate"
- Wiry sa automaticky prepoja (pozicie pinov sa prepocitaju)

---

## 12. Rizika a mitigacie

| Riziko | Dopad | Mitigacia |
|---|---|---|
| React Flow nevyhovuje custom requirements | Velky refaktor | Prototype spike — overit klucoce features pred commitom na React Flow |
| Performance pri velkych obvodoch (100+ modulov) | Laggy UI | Truth table cache, memoizacia, pripadne Web Worker pre simulaciu |
| Manhattan routing vizualne chaoticky pri mnohych wiroch | Slaba UX | Zacat s L/Z-shape, pridat wire colors pre odlisenie |
| User vytvori modul s 20+ inputmi | Pomale generovanie truth table | Threshold + async generovanie vo Web Workeri |

---

## 13. Implementacne iteracie

Kazda iteracia konci overitelnym vysledkom. Tasky su zoradene tak, ze kazdy
zavisi len na predchadzajucich taskoch v ramci iteracie alebo na predchadzajucich iteraciach.

---

### Iteracia 1 — Projekt setup + core typy

Vysledok: prazdna appka sa zbuilduje a spusti, core typy su definovane a otestovane.

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 1.1 | Vite + React + TS init | `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` | `npm create vite@latest` s React + TypeScript templatom |
| 1.2 | Tailwind CSS setup | `tailwind.config.ts`, `src/index.css` | Instalacia a konfiguracia Tailwind |
| 1.3 | Instalacia dependencies | `package.json` | `@xyflow/react`, `zustand`, `uuid` |
| 1.4 | Vitest setup | `vite.config.ts`, `package.json` | Vitest konfiguracia, test script |
| 1.5 | Projekt struktura | `src/engine/`, `src/store/`, `src/components/`, `src/hooks/`, `src/utils/` | Vytvorenie priecinkoveho stromu |
| 1.6 | Core typy | `src/engine/types.ts` | `Pin`, `CircuitNode`, `Edge`, `Circuit`, `Module`, `TruthTable`, vsetky ID typy |
| 1.7 | UUID helper | `src/utils/id.ts` | Funkcia na generovanie unikatnych ID |

---

### Iteracia 2 — Simulation engine

Vysledok: engine dokaze evaluovat obvod zlozeny z NAND gatov, vsetko pokryte unit testami.

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 2.1 | NAND evaluacia | `src/engine/simulate.ts` | Funkcia `evaluateNand(a: boolean, b: boolean): boolean` → `!(a && b)` |
| 2.2 | Graf reprezentacia | `src/engine/simulate.ts` | Funkcia `buildAdjacencyList(circuit: Circuit)` — z nodes + edges vytvori adjacency list pre traversal |
| 2.3 | Topologicke zoradenie | `src/engine/simulate.ts` | Funkcia `topologicalSort(circuit: Circuit)` — urcenie poradia evaluacie nodov |
| 2.4 | Circuit evaluacia | `src/engine/simulate.ts` | Funkcia `evaluateCircuit(circuit: Circuit, inputs: Record<PinId, boolean>): Record<PinId, boolean>` — kompletny prechod obvodom, vracia hodnoty na vsetkych output pinoch |
| 2.5 | Testy NAND | `tests/engine/simulate.test.ts` | Vsetky 4 kombinacie NAND (00→1, 01→1, 10→1, 11→0) |
| 2.6 | Testy circuit eval | `tests/engine/simulate.test.ts` | Test: NOT z 1x NAND, AND z NAND+NOT, overenie spravnych vystupov |
| 2.7 | Cycle detection | `src/engine/validate.ts` | Funkcia `hasCycle(circuit: Circuit): boolean` — DFS cycle detection |
| 2.8 | Self-reference detection | `src/engine/validate.ts` | Funkcia `hasTransitiveSelfReference(moduleId: ModuleId, modules: Module[]): boolean` |
| 2.9 | Testy validacia | `tests/engine/validate.test.ts` | Testy: acyklicky graf → false, cyklus → true, tranzitivna self-referencia → true |

---

### Iteracia 3 — Truth table engine

Vysledok: z lubovolneho circuit vygeneruje truth table, lookup funkcia funguje.

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 3.1 | Truth table generovanie | `src/engine/truth-table.ts` | Funkcia `generateTruthTable(circuit: Circuit, modules: Module[]): TruthTable` — iteruje vsetky input kombinacie, vola `evaluateCircuit` |
| 3.2 | Threshold logika | `src/engine/truth-table.ts` | Ak inputov > 16, vrati `null` (negeneruje sa) |
| 3.3 | Truth table lookup | `src/engine/truth-table.ts` | Funkcia `lookupTruthTable(table: TruthTable, inputs: Record<string, boolean>): Record<string, boolean>` |
| 3.4 | Module evaluacia s cache | `src/engine/simulate.ts` | Rozsirenie `evaluateCircuit` — ak node type === "module" a modul ma truth table → lookup namiesto rekurzie |
| 3.5 | Testy truth table | `tests/engine/truth-table.test.ts` | Test: NOT truth table (2 riadky), XOR truth table (4 riadky), lookup spravnost |
| 3.6 | Testy module eval s cache | `tests/engine/simulate.test.ts` | Test: obvod s vnorenym modulom ktory ma truth table — overenie ze vysledok je spravny |

---

### Iteracia 4 — Canvas zaklad

Vysledok: canvas s gridom, mozno pridat NAND/Input/Output/Constant nody, vizualne sa renderuju.

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 4.1 | App layout shell | `src/App.tsx` | Zakladny layout: toolbar (placeholder), library panel (placeholder), canvas area |
| 4.2 | React Flow canvas | `src/components/Canvas/Canvas.tsx` | `<ReactFlow>` s gridom, pan, zoom. `nodeTypes` a `edgeTypes` definovane **mimo** komponent (P1). |
| 4.3 | Circuit store | `src/store/circuit-store.ts` | Zustand store: `nodes`, `edges`, `activeModuleId`, akcie `addNode`, `removeNode`, `addEdge`, `removeEdge`, `onNodesChange`, `onEdgesChange` |
| 4.4 | ModuleNode (univerzalny) | `src/components/Canvas/ModuleNode.tsx` | `React.memo` (P2). Obdlznik s menom modulu v strede. Handles sa generuju dynamicky z interface pinov (inputs vlavo, outputs vpravo). NAND je prvy modul ktory sa renderuje cez tento komponent. |
| 4.5 | Input node | `src/components/Canvas/InputNode.tsx` | `React.memo`. 1 source handle vpravo. Toggle button (0/1). Editovatelne meno (nazov pinu). |
| 4.6 | Output node | `src/components/Canvas/OutputNode.tsx` | `React.memo`. 1 target handle vlavo. LED indikator (cervena/zelena). Editovatelne meno. |
| 4.7 | Constant node | `src/components/Canvas/ConstantNode.tsx` | `React.memo`. 1 source handle vpravo. Fixna hodnota 0 alebo 1 (konfigurovatelna cez klik). Na rozdiel od Input: nema toggle pri simulacii, je "hardwired". Pouzitie: pull-down/pull-up, fixne vstupy do gates. |
| 4.8 | Pridavanie nodov na canvas | `src/components/Canvas/Canvas.tsx` | Docasne tlacidla (alebo drag z library placeholder) na pridanie NAND, Input, Output, Constant na canvas. |

---

### Iteracia 5 — Wiring

Vysledok: user moze prepajat piny wirami, wiry sa zobrazuju ako manhattan L/Z-shape.

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 5.1 | Basic wiring (rovne ciary) | `src/components/Canvas/Canvas.tsx` | React Flow `onConnect` callback → prida edge do store. Defaultny edge type (rovne ciary) pre overenie funkcionality. |
| 5.2 | Wire validacia | `src/hooks/useWiring.ts` | `isValidConnection(connection)`: output → input only, nie input → input, nie duplicita, cycle check |
| 5.3 | Manhattan edge komponent | `src/components/Canvas/ManhattanEdge.tsx` | `React.memo`. SVG path: Z-shape (horizontal → vertical → horizontal). Ak piny v rovnakej vyske → rovny wire. |
| 5.4 | Nastavenie manhattan ako default | `src/components/Canvas/Canvas.tsx` | `edgeTypes = { manhattan: ManhattanEdge }`, `defaultEdgeOptions = { type: 'manhattan' }` |
| 5.5 | Wire selekcia a mazanie | `src/components/Canvas/Canvas.tsx` | Klik na wire → highlight. Delete/Backspace → zmaz vybrany wire. |
| 5.6 | Wire vizual (active/inactive) | `src/components/Canvas/ManhattanEdge.tsx` | Wire farba podla hodnoty signalu: seda (0/neznamy), zelena (1). Cita hodnotu z simulation store. |

---

### Iteracia 6 — Live simulacia na canvase

Vysledok: klik na Input toggle zmeni hodnoty na wiroch a Output nodoch v real-time. Probe zobrazuje hodnoty na wiroch.

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 6.1 | Simulation store | `src/store/simulation-store.ts` | Zustand store: `wireValues: Record<PinId, boolean>`, akcia `runSimulation(circuit, modules)` |
| 6.2 | useSimulation hook | `src/hooks/useSimulation.ts` | Napojenie engine na React: pri zmene inputu alebo wiring-u zavola `evaluateCircuit`, vysledok zapise do simulation store |
| 6.3 | Input toggle → simulacia | `src/components/Canvas/InputNode.tsx` | Klik na toggle → zmena hodnoty v circuit store → trigger simulacie |
| 6.4 | Output vizualizacia | `src/components/Canvas/OutputNode.tsx` | Cita hodnotu z simulation store, zobrazi 0/1 + farbu LED |
| 6.5 | ModuleNode vizualizacia | `src/components/Canvas/ModuleNode.tsx` | Volitelne: zobrazenie aktualnej output hodnoty na module (NAND aj user-created) |
| 6.6 | Probe node | `src/components/Canvas/ProbeNode.tsx` | `React.memo`. 1 target handle vlavo (input only). Zobrazuje aktualnu hodnotu signalu (0/1) na wiri bez ovplyvnenia obvodu. Na rozdiel od Output: nema meno, nesluzi ako interface pin modulu, je cisto debugovaci nastroj. |
| 6.7 | End-to-end test | manualne | Postavit NOT z NAND na canvase: Input → NAND (oba vstupy) → Output. Toggle input, overit ze output sa meni spravne. Pripojit Probe na wire, overit ze zobrazuje hodnotu. |

---

### Iteracia 7 — Module system: ukladanie

Vysledok: user vytvori novy modul, edituje ho na canvase, ulozi ho do kniznice.

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 7.1 | Module store | `src/store/module-store.ts` | Zustand store: `modules: Module[]`, akcie `addModule`, `updateModule`, `deleteModule`, `getModuleById` |
| 7.2 | New Module flow | `src/components/Toolbar/Toolbar.tsx` | Tlacidlo "New Module" → input dialog na meno → vytvori prazdny modul v store → nastavi ako `activeModuleId` → vycisti canvas |
| 7.3 | Save flow | `src/components/Toolbar/Toolbar.tsx` | Tlacidlo "Save" / Ctrl+S → precita canvas → detekuje Input/Output nody → vytvori/aktualizuje Module v store |
| 7.4 | Pin name z Input/Output nodov | `src/components/Canvas/InputNode.tsx`, `OutputNode.tsx` | Editovatelne textove pole na node → meno sa pouzije ako pin name v module interface |
| 7.5 | Interface pin detekcia | `src/store/circuit-store.ts` | Funkcia `extractInterface(circuit: Circuit): { inputs: Pin[], outputs: Pin[] }` — vyberie vsetky Input/Output nody, vytvori z nich Pin[] |
| 7.6 | Truth table gen pri save | `src/store/module-store.ts` | Po ulozeni: ak inputov ≤ 16 → zavola `generateTruthTable`, vysledok ulozi do modulu |
| 7.7 | Validacia pri save | `src/store/module-store.ts` | Min 1 input + 1 output, meno nie je "NAND", no self-reference. Warnings pre nepripojene piny. |
| 7.8 | Nazov modulu v hlavicke | `src/components/Toolbar/Toolbar.tsx` | Zobrazenie nazvu aktualne editovaneho modulu v toolbare |

---

### Iteracia 8 — Module system: kniznica a pouzitie

Vysledok: user vidi ulozene moduly v paneli, moze ich pretiahnut na canvas a pouzit.

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 8.1 | Library panel | `src/components/Library/LibraryPanel.tsx` | Lavy panel: zoznam modulov. Prvy vzdy "NAND" (built-in, nemazatelny). Pod nim user-created moduly. |
| 8.2 | Module card | `src/components/Library/ModuleCard.tsx` | Karta modulu: meno, pocet in/out pinov. Klik → otvori na canvas. |
| 8.3 | Drag z library na canvas | `src/components/Library/LibraryPanel.tsx`, `Canvas.tsx` | Drag & drop z library panelu → vytvori novy node typu "module" na canvase |
| 8.4 | Module simulacia | `src/hooks/useSimulation.ts` | Rozsirenie: ak node je module → pouzit truth table lookup alebo rekurzivnu evaluaciu |
| 8.5 | Otvorenie modulu na editaciu | `src/components/Library/ModuleCard.tsx` | Klik na modul v library → unsaved changes check → nacita circuit modulu na canvas → nastavi `activeModuleId` |
| 8.6 | NAND v library | `src/components/Library/LibraryPanel.tsx` | NAND je v library ako built-in, draggable na canvas, nie je editovatelny ani mazatelny. Renderuje sa cez rovnaky ModuleNode ako vsetky ostatne moduly. |

---

### Iteracia 9 — Editacia pouziteho modulu + kaskadovanie

Vysledok: editacia modulu propaguje zmeny vsade kde je pouzity, breaking changes maju warning.

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 9.1 | Interface diff detection | `src/engine/validate.ts` | Funkcia `diffInterface(oldModule: Module, newModule: Module): { added: Pin[], removed: Pin[], renamed: Pin[] }` |
| 9.2 | Dependent modules lookup | `src/store/module-store.ts` | Funkcia `getModulesDependingOn(moduleId: ModuleId): Module[]` — najde vsetky moduly ktore pouzivaju dany modul |
| 9.3 | Non-breaking save | `src/store/module-store.ts` | Ak sa interface nezmenil alebo len pridany/premenovany pin → tiche ulozenie, update definicie |
| 9.4 | Breaking change warning | `src/components/SaveModule/SaveWarningDialog.tsx` | Dialog: "Pin X bol odobrany. Pouzity v moduloch Y, Z. Ulozit / Zrusit" |
| 9.5 | Wire odpojenie pri removed pin | `src/store/module-store.ts` | Po potvrdeni: vo vsetkych parent moduloch najdi edges pripojene na removed pin → odstran ich |
| 9.6 | Kaskadova truth table regeneracia | `src/store/module-store.ts` | Po ulozeni: regeneruj truth table zmeneneho modulu + vsetkych modulov ktore ho tranzitivne pouzivaju |
| 9.7 | Mazanie modulu (nepouzity) | `src/components/Library/ModuleCard.tsx` | Kontextove menu / tlacidlo delete → ak nikde nepouzity → zmaz |
| 9.8 | Mazanie modulu (pouzity) | `src/components/Library/ModuleCard.tsx`, `SaveWarningDialog.tsx` | Warning dialog → po potvrdeni: odstran vsetky instancie z parent modulov, odpoj wiry, regeneruj truth tables |

---

### Iteracia 10 — Rotacia

Vysledok: user moze otacat lubovolny node, piny sa prepocitaju, wiry sa prerouting-uju.

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 10.1 | Rotacia v store | `src/store/circuit-store.ts` | Akcia `rotateNode(nodeId: NodeId)` — cyklicky: 0→90→180→270→0 |
| 10.2 | Pin pozicia podla rotacie | `src/utils/layout.ts` | Funkcia `getHandlePosition(pin: Pin, rotation: number): { position: Position, style: CSSProperties }` |
| 10.3 | NAND node rotacia | `src/components/Canvas/NandNode.tsx` | Handles sa renderuju podla `rotation` property nodu |
| 10.4 | ModuleNode rotacia | `src/components/Canvas/ModuleNode.tsx` | Rovnako — handles sa prepolozia podla rotacie |
| 10.5 | Input/Output node rotacia | `src/components/Canvas/InputNode.tsx`, `OutputNode.tsx` | Handle sa presunie na prislusnu stranu |
| 10.6 | Keyboard shortcut R | `src/components/Canvas/Canvas.tsx` | Klaves `R` pri selektovanom node → `rotateNode` |
| 10.7 | Context menu Rotate | `src/components/Canvas/Canvas.tsx` | Pravy klik na node → "Rotate" option |

---

### Iteracia 11 — Truth table view

Vysledok: user si moze zobrazit truth table pre lubovolny modul z kniznice.

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 11.1 | Truth table panel/modal | `src/components/TruthTable/TruthTableView.tsx` | Modal s vyberom modulu (dropdown) a tabulkou |
| 11.2 | Tlacidlo v toolbare | `src/components/Toolbar/Toolbar.tsx` | "Truth Table" tlacidlo → otvori modal |
| 11.3 | Tabulka rendering | `src/components/TruthTable/TruthTableView.tsx` | Hlavicka: input mena + output mena. Riadky: vsetky kombinacie. Hodnoty 0/1 s farebnym rozlisenim. |
| 11.4 | Paginacia / virtual scroll | `src/components/TruthTable/TruthTableView.tsx` | Pre > 256 riadkov: strankovanie (napr. 50 riadkov na stranku) |
| 11.5 | On-demand generovanie | `src/components/TruthTable/TruthTableView.tsx` | Ak modul nema truth table (> 16 inputov) → zobraz info "Prilis vela inputov pre truth table" alebo generuj on-demand s loading indikatorom |

---

### Iteracia 12 — Persistencia + export/import

Vysledok: stav appky prezije refresh, moduly sa daju exportovat a importovat ako JSON.

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 12.1 | localStorage save | `src/utils/persistence.ts` | Funkcie `saveModules(modules)`, `saveActiveCircuit(circuit, moduleId)`, `saveSettings(settings)` |
| 12.2 | localStorage load | `src/utils/persistence.ts` | Funkcie `loadModules(): Module[]`, `loadActiveCircuit(): { circuit, moduleId }`, `loadSettings()` |
| 12.3 | Autosave | `src/store/circuit-store.ts` | Zustand `subscribe` → pri zmene stavu automaticky uloz do localStorage (debounced, napr. 500ms) |
| 12.4 | Restore pri starte | `src/App.tsx` | Pri mounte nacitaj modules + posledny aktivny modul z localStorage |
| 12.5 | Unsaved changes dialog | `src/components/Canvas/UnsavedChangesDialog.tsx` | Pri prepnuti modulu alebo New Module → ak su zmeny → "Save / Discard / Cancel" |
| 12.6 | JSON export | `src/utils/persistence.ts` | Funkcia `exportToJson(modules, activeCircuit)` → `JSON.stringify` → trigger file download (`.json`) |
| 12.7 | JSON import | `src/utils/persistence.ts` | Funkcia `importFromJson(file: File)` → parsuje JSON → validuje strukturu → nahradi stav v stores |
| 12.8 | Export/Import tlacidla | `src/components/Toolbar/Toolbar.tsx` | Tlacidla v toolbare: "Export" → download, "Import" → file picker |

---

### Iteracia 13 — Undo/Redo (snapshot)

Vysledok: Ctrl+Z a Ctrl+Shift+Z funguju. Jednoduchy snapshot-based pristup (nie command pattern — ten pride v post-MVP iteracii 18).

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 13.1 | History store | `src/store/circuit-store.ts` | History stack: pole `{ nodes, edges }` snapshotov. `past: []`, `future: []`. Snapshot sa vytvori pred kazdou simulation-relevant mutaciou. Max ~50 snapshotov. |
| 13.2 | Undo/Redo akcie | `src/store/circuit-store.ts` | `undo()`: posun aktualny stav do `future`, obnov posledny z `past`. `redo()`: opacne. |
| 13.3 | Keyboard shortcuts | `src/components/Canvas/Canvas.tsx` | Ctrl+Z → undo, Ctrl+Shift+Z / Ctrl+Y → redo. |
| 13.4 | Toolbar tlacidla | `src/App.tsx` | Undo/Redo tlacidla v toolbare. Disabled ked stack prazdny. |

---

### Iteracia 14 — Polish a edge cases

Vysledok: appka je robustna, vizualne cista, pripravena na pouzitie.

| # | Task | Subor(y) | Popis |
|---|---|---|---|
| 14.1 | Status bar | `src/components/StatusBar/StatusBar.tsx` | Spodny bar: pocet nodov, pocet wirov, nazov aktivneho modulu, stav simulacie |
| 14.2 | Error toasty | `src/components/shared/Toast.tsx` | Jednotny system pre zobrazovanie warnings a errors (cycle detected, invalid connection, ...) |
| 14.3 | Node mazanie s cleanup | `src/store/circuit-store.ts` | Delete nodu → automaticky zmaz vsetky pripojene wiry |
| 14.4 | Empty state | `src/components/Canvas/Canvas.tsx` | Ak je canvas prazdny → zobraz hint "Drag components from library to start building" |
| 14.5 | Keyboard shortcuts | `src/components/Canvas/Canvas.tsx` | Ctrl+S (save), Delete (zmaz), R (rotate) — sumar vsetkych shortcuts |
| 14.6 | Performance audit | — | Test s 50+ nodmi: overit FPS, identifikovat bottlenecky, aplikovat P1–P5 ak treba |
| 14.7 | Visual polish | vsetky komponenty | Konzistentny styling, hover stavy, transition animacie na wiroch |

---

## 14. Definicia "done" pre MVP

MVP je hotove ked uzivatel dokaze:

1. Vytvorit novy modul s nazvom
2. Postavit NOT gate z 1x NAND (input do oboch vstupov)
3. Ulozit ho ako modul "NOT"
4. Otvorit novy modul, pouzit NOT + NAND na stavbu AND gate
5. Ulozit ako modul "AND"
6. Pokracovat v budovani hierarchie (OR, XOR, ...)
7. Editovat existujuci modul — zmeny sa propaguju
8. Zobrazit truth table pre lubovolny modul
9. Otacat komponenty na canvase
10. Zavriet browser, otvorit znova — stav sa obnovil
11. Exportovat vsetky moduly do JSON suboru
12. Importovat JSON subor a obnovit stav
