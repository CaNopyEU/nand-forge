# NAND Forge — Status

## Quick Start pre Claude

Toto je interaktivny circuit builder kde jediny built-in gate je NAND.
Pred zaciatakom prace precitaj:

1. Tento subor — aktualny stav, rozhodnutia, poznamky
2. `tech-spec.md` — kompletna technicka specifikacia MVP (iteracie 1–13)
3. `post-mvp-roadmap.md` — post-MVP roadmap (iteracie 14–35) — **citat az ked je MVP hotove**

---

## Aktualny stav

**Faza:** Implementacia
**Aktualna iteracia:** 13 (DONE)
**Posledna zmena:** Iteracia 13 dokoncena

### Progress tracker

| Iteracia | Nazov | Status |
|---|---|---|
| 1 | Projekt setup + core typy | ✅ DONE |
| 2 | Simulation engine | ✅ DONE |
| 3 | Truth table engine | ✅ DONE |
| 4 | Canvas zaklad | ✅ DONE |
| 5 | Wiring | ✅ DONE |
| 6 | Live simulacia na canvase | ✅ DONE |
| 7 | Module system: ukladanie | ✅ DONE |
| 8 | Module system: kniznica a pouzitie | ✅ DONE |
| 9 | Editacia pouziteho modulu + kaskadovanie | ✅ DONE |
| 10 | Rotacia | ✅ DONE |
| 11 | Truth table view | ✅ DONE |
| 12 | Persistencia + export/import | ✅ DONE |
| 13 | Undo/Redo (snapshot) | ✅ DONE |
| 14 | Polish a edge cases | ⬜ TODO |

Statusy: ⬜ TODO | 🔧 IN PROGRESS | ✅ DONE

---

## Klucove architektonicke rozhodnutia

### R1: NAND-first pristup
- Jediny built-in gate je NAND. Vsetko ostatne (NOT, AND, OR, XOR...) si user buduje sam.
- NAND je built-in modul s fixnym `moduleId: "builtin:nand"`, engine ho evaluuje priamo `!(a && b)`.

### R2: Jednotny vizual modulov
- NAND nema specialnu grafiku. Vsetky moduly (vratane NAND) su obdlznik s menom.
- Neexistuje `NandNode.tsx` — vsetko renderuje `ModuleNode.tsx`.
- Dovod: konzistencia, jednoduchsi kod, ziadne special cases v renderovani.

### R3: Reference-based moduly (nie snapshot)
- Povodne sme planovali snapshot (kopia pri vlozeni). Zmenene na reference-based uz v MVP.
- Zmena logiky modulu sa propaguje do vsetkych instancii.
- Breaking changes (odobranie pinu) → warning dialog → odpojenie wirov.
- Dovod: NAND-first pristup vyzaduje aby zmena zakladneho modulu (napr. NOT) ovplyvnila vsetko co ho pouziva.

### R4: Truth table ako simulacny cache
- Truth table sa generuje pri ulozeni modulu (nie pri kazdom pouziti).
- Threshold: ≤ 16 inputov → lookup table, > 16 → rekurzivna simulacia.
- Lookup je O(1) bez ohladu na zlozitost modulu — nepotrebujeme hardcoded logiku pre AND, OR atd.
- Dovod: masivny performance boost pri vnorenych moduloch.

### R5: Canvas = vzdy konkretny modul
- Neexistuje "volny canvas". User vzdy pracuje na pomenovanom module.
- "New Module" → zadaj meno → cisty canvas.
- Klik na modul v library → otvori na editaciu.
- Save uklada aktualny stav modulu, canvas ostava otvoreny.
- Dovod: jednoznacna persistencia — vzdy vies co ukladas.

### R6: Piny su vzdy interface piny
- Vsetky Input/Output nody na canvase sa automaticky stanu interface pinmi modulu.
- Aj nepripojene piny su interface piny (warning, nie error).
- Pin mena sa edituju priamo na Input/Output nodoch.
- Dovod: jednoduchost — ziadne manualne oznacovanie co je interface a co nie.

### R7: React Flow ako framework
- Validovane: custom handles (viacero pinov na node) — OK.
- Validovane: custom edge routing (manhattan) — OK.
- Validovane: performance pri 100+ nodoch s dodrzanim pravidiel P1–P5 — OK.
- Performance pravidla su **povinne od prveho riadku kodu** (vid tech-spec sekcia 7.2).

### R8: Manhattan wiring — naivny L/Z-shape
- MVP pouziva jednoduchy 3-segmentovy Z-shape path (horizontal → vertical → horizontal).
- Ziadny pathfinding, ziadne obchadzanie komponentov.
- Dovod: jednoduche, vizualne dostatocne. Pathfinding pride post-MVP.

### R9: Tri-state buffer az po RAM (iteracia 23)
- Tri-state pridava treti stav (Z) do simulacie — meni core engine.
- Pre MVP a jednoduchy CPU staci multiplexer (postavitelny z NAND).
- Dovod: nechceme menit core engine kym nie je stabilny.

### R10: Convenience komponenty
- MVP: Constant (0/1), Probe (debug)
- Post-MVP Faza A: Button (pulse) — momentany signal
- Post-MVP Faza B: Splitter/Merger, DIP switch, Hex display, LED bar, Tunnel/Label

---

## Otvorene otazky / Buduci vyskum

- React Flow vs vlastny SVG: rozhodnute v prospech React Flow, ale ak sa objavi blocker → fallback plan existuje
- Web Worker pre simulaciu: zvazit az ked sa objavia performance problemy
- Undo/Redo: MVP iteracia 13 = jednoduchy snapshot-based undo (history stack of {nodes, edges}). Post-MVP iteracia 18 = upgrade na command pattern (batch ops, memory-efektivnejsie)

---

## Poznamky z poslednej session

_Tu sa budu pridavat poznamky z kazdeho pracovneho session. Najnovsie hore._

### Session 2026-02-06 (iteracia 13)
- Implementovany snapshot-based undo/redo v `src/store/circuit-store.ts`:
  - Novy typ `Snapshot = { nodes: AppNode[]; edges: RFEdge[] }`
  - Stav: `past: Snapshot[]` (max 50), `future: Snapshot[]`
  - Helper `pushSnapshot(state)` — ulozi aktualny `{nodes, edges}` do `past`, vycisti `future`
  - `pushSnapshot` volany automaticky pred kazdou content-changing mutaciou:
    - `addNode`, `removeNode`, `addEdge`, `removeEdge`
    - `toggleInputValue`, `toggleConstantValue`, `rotateNode`
    - `updateNodeLabel`, `setEdgeColor`
    - `onNodesChange` pri removal, `onEdgesChange` pri removal
  - `undo()` — ak `past` neprazdny: presun aktualny stav do `future`, obnov posledny z `past`, bump `simulationVersion`
  - `redo()` — ak `future` neprazdny: presun aktualny stav do `past`, obnov prvy z `future`, bump `simulationVersion`
  - `takeSnapshot()` — public akcia pre externych volajucich (napr. drag start)
  - `clearCanvas()` a `loadCircuit()` resetuju `past` a `future` na `[]` (zmena kontextu)
- Aktualizovane `src/components/Canvas/Canvas.tsx`:
  - Keyboard shortcut `Ctrl+Z` → `undo()`, `Ctrl+Shift+Z` / `Ctrl+Y` → `redo()` (guard pre input/textarea/select focus)
  - `onNodeDragStart` callback vola `takeSnapshot()` — drag nodov je undoable
- Aktualizovane `src/components/Toolbar/Toolbar.tsx`:
  - Nove tlacidla "Undo" a "Redo" medzi module info a right-side buttons
  - `disabled` styling ked prislusny stack prazdny (`past.length === 0` / `future.length === 0`)
  - Title atributy s keyboard shortcut hintami
- Persistence: `past`/`future` sa NEPERSISTUJU — `saveCanvasState()` v `persistence.ts` explicitne destrukturuje len `{nodes, edges, activeModuleId}`
- Verifikacia: `tsc -b` zero errors, `npm run build` OK

### Session 2026-02-06 (library D&D positional reordering — bonus)
- Aktualizovane `src/store/library-store.ts`:
  - `moveModuleToFolder` rozsireny o volitelny `insertIndex?: number` parameter
  - Nove helpery: `findModulePosition(tree, moduleId)` — najde container a index modulu v strome
  - `insertModuleAt(tree, moduleId, folderId, index)` — vlozi module ref na presnu poziciu
  - Same-container index adjustment: ak modul bol pred cielovym indexom, dekrementuj index
- Aktualizovane `src/components/Library/ModuleCard.tsx`:
  - Nove props: `parentFolderId`, `indexInParent`, `locked`, `onReorder`
  - Top/bottom half detection cez `getBoundingClientRect()` + `e.clientY`
  - `dropPosition: "before" | "after" | null` state s vizualnym indikatorom (`border-t-2 border-t-blue-500` / `border-b-2 border-b-blue-500`)
  - Na drop: vola `onReorder(draggedId, parentFolderId, index)` s vypocitanym insert indexom
- Aktualizovane `src/components/Library/FolderNode.tsx`:
  - Tri-zone detection: top 25% = "before", middle 50% = "inside", bottom 25% = "after"
  - Nove props: `parentFolderId`, `indexInParent`, `onReorder`
  - Vizualne indikatory: blue top/bottom border pre before/after, blue ring pre inside
  - Na drop: "before"/"after" → `onReorder`, "inside" → `moveModuleToFolder` (append)
- Aktualizovane `src/components/Library/LibraryTree.tsx`:
  - Novy prop `onReorder` na `LibraryTreeProps`
  - `RenderNode` dostava a propaguje `parentFolderId`, `indexInParent`, `locked`, `onReorder` do `ModuleCard` a `FolderNode`
- Aktualizovane `src/components/Library/LibraryPanel.tsx`:
  - Novy `handleReorder` callback volajuci `moveModuleToFolder(moduleId, targetFolderId, insertIndex)`
  - Wired cez `<LibraryTree onReorder={handleReorder} />`
- Verifikacia: `tsc -b` zero errors, `npm run build` OK

### Session 2026-02-04 (iteracia 12)
- Vytvorene `src/utils/persistence.ts` — kompletna persistence + export/import logika:
  - `STORAGE_KEYS` — `nandforge:modules` a `nandforge:canvas`
  - `saveModules(modules)` / `loadModules()` — JSON serialize/deserialize do localStorage s graceful error handling
  - `saveCanvasState(state)` / `loadCanvasState()` — uklada `{ nodes, edges, activeModuleId }` ako `CanvasState`
  - Inline `debounce(fn, ms)` utility (bez externej dependency)
  - `initAutosave()` — subscribe na `useModuleStore` a `useCircuitStore` s 500ms debounce, automaticky uklada pri kazdej zmene
  - `exportToJson(modules)` — vytvori `{ version: 1, modules }`, `Blob` → `URL.createObjectURL` → `<a>.click()` → download `nandforge-export.json`
  - `importFromJson(file)` — `file.text()` → JSON parse → validacia struktury (modules array, kazdy modul ma id, name, inputs, outputs, circuit s nodes/edges) → return `{ modules }`
- Aktualizovane `src/main.tsx`:
  - Pred `createRoot`: `loadModules()` → `useModuleStore.setState`, `loadCanvasState()` → `useCircuitStore.setState` (s `isDirty: false`)
  - Volany `initAutosave()` — stav sa automaticky uklada od startu
- Vytvorene `src/components/UnsavedChangesDialog.tsx`:
  - Props: `open`, `canSave`, `onSave`, `onDiscard`, `onCancel`
  - 3 tlacidla: Save (podmienene na `canSave`), Discard (cervene), Cancel
  - Styling konzistentny s `SaveWarningDialog` (overlay, rounded-lg, border-zinc-700, bg-zinc-800)
  - Escape → cancel
- Aktualizovane `src/components/Toolbar/Toolbar.tsx`:
  - Novy state `pendingAction: "new" | null` pre unsaved changes flow
  - "New Module" → ak `isDirty` → `UnsavedChangesDialog` (Save → `saveCurrentModule()` + open dialog, Discard → open dialog, Cancel → zavriet)
  - "Export" tlacidlo → vola `exportToJson(modules)`
  - "Import" tlacidlo → triggeruje hidden `<input type="file" accept=".json">` cez ref
  - Import handler: `importFromJson(file)` → `useModuleStore.setState({ modules })` + `clearCanvas()` + `setActiveModuleId(null)` + toast "Imported N modules."
  - Error handling pre import s toast notifikaciou
  - Input ref reset po importe (umoznuje opakovany vyber rovnakeho suboru)
- Aktualizovane `src/components/Library/LibraryPanel.tsx`:
  - Novy state `pendingOpenId: string | null` pre unsaved changes flow
  - `handleOpen` → ak `isDirty` → `setPendingOpenId` → `UnsavedChangesDialog`
  - Save → `saveCurrentModule()` → ak success → `executeOpen(targetId)`
  - Discard → `executeOpen(targetId)` priamo
  - Cancel → `setPendingOpenId(null)`
  - `executeOpen` extrahovany do `useCallback` pre reuse
- Ziadne nove testy — cisto UI + localStorage/File API logika, existujuce testy neovplyvnene
- Verifikacia: `tsc -b` zero errors, 67/67 testov OK

### Session 2026-02-04 (iteracia 11)
- Vytvorene `src/components/TruthTable/TruthTableView.tsx` — modal komponent:
  - Dropdown na vyber modulu (NAND built-in + vsetky user moduly z `useModuleStore`)
  - Tabulka s hlavickou (input mena + output mena) a riadkami (vsetky kombinacie)
  - Mapovanie pin IDs na display mena: `module.inputs.find(p => p.id === pinId)?.name`
  - Farebne rozlisenie hodnot: `0` = `text-zinc-500`, `1` = `text-emerald-400 font-bold`
  - Output stlpce oddelene thin left border separatorom
  - Zebra striping na alternujucich riadkoch
  - Hardcoded NAND truth table (`{ "00": "1", "01": "1", "10": "1", "11": "0" }`) — NAND ma prazdny circuit, generovanie by zlyhalo
  - On-demand generovanie cez `generateTruthTable(module.circuit, modules)` pre moduly bez cachovaneho truth table (≤16 inputov)
  - Info sprava "Too many inputs (N) — truth table requires ≤ 16 inputs" pre moduly s >16 inputmi
  - Paginacia: `ROWS_PER_PAGE = 64`, ◀ ▶ navigacia, page reset pri zmene modulu
  - Zatvaranie: X button, Escape, klik na overlay
- Aktualizovane `src/components/Toolbar/Toolbar.tsx`:
  - Novy state `showTruthTable: boolean`
  - "Truth Table" tlacidlo v toolbar button row (pred New Module)
  - Renderovany `<TruthTableView open={showTruthTable} onClose={...} />`
- Ziadne nove testy — cisto UI komponent, engine logika pokryta existujucimi testami v `tests/engine/truth-table.test.ts`
- Verifikacia: `tsc -b` zero errors, 67/67 testov OK

### Session 2026-02-04 (iteracia 10)
- Vytvorene `src/utils/layout.ts` — pure utility funkcie pre rotaciu:
  - `Rotation` typ (`0 | 90 | 180 | 270`)
  - `nextRotation(r)` — cyklicka rotacia 0→90→180→270→0
  - `getInputPosition(r)` — strana pre target handles (0°=Left, 90°=Top, 180°=Right, 270°=Bottom)
  - `getOutputPosition(r)` — strana pre source handles (0°=Right, 90°=Bottom, 180°=Left, 270°=Top)
  - `isVerticalSide(pos)` — Left/Right = true (piny distribuovane vertikalne)
  - `getHandleDistributionStyle(pos, index, total)` — inline style pre distribuciu handleov (top % alebo left %)
- Aktualizovane `src/store/circuit-store.ts`:
  - Pridany `rotation: Rotation` do vsetkych 5 node data typov (`InputNodeData`, `OutputNodeData`, `ConstantNodeData`, `ProbeNodeData`, `ModuleNodeData`)
  - Nova akcia `rotateNode(nodeId)` — cita aktualnu rotaciu, aplikuje `nextRotation()`, nastavi `isDirty`
  - `addNode` inicializuje `rotation: 0` pre vsetky node typy
- Aktualizovane `src/utils/canvas-to-circuit.ts`:
  - Vsetkych 5 case branches cita `node.data.rotation ?? 0` namiesto hardcoded `0`
- Aktualizovane `src/utils/circuit-converters.ts`:
  - Vsetkych 5 case branches v `circuitNodesToAppNodes` pridava `rotation: node.rotation ?? 0` do data objektu
- Aktualizovane `src/components/Canvas/ModuleNode.tsx`:
  - Dynamicke handle pozicie cez `getInputPosition`/`getOutputPosition`
  - Label repozicioning: vertikalne strany → `left/right` + `top: %`, horizontalne strany → `top/bottom` + `left: %`
  - Pri 90°/270° rotacii swap `minWidth`/`minHeight` pre sirsi node
  - Handles distribuovane cez `getHandleDistributionStyle`
- Aktualizovane 4 jednoduche node komponenty:
  - `InputNode.tsx` — source handle pouziva `getOutputPosition(data.rotation)`
  - `OutputNode.tsx` — target handle pouziva `getInputPosition(data.rotation)`
  - `ConstantNode.tsx` — source handle pouziva `getOutputPosition(data.rotation)`
  - `ProbeNode.tsx` — target handle pouziva `getInputPosition(data.rotation)`
- Aktualizovane `src/components/Canvas/Canvas.tsx`:
  - Keyboard shortcut `R` — rotuje vsetky selected nody (guard pre input/textarea focus)
  - Context menu: `onNodeContextMenu` → right-click na node zobrazuje positioned `<div>` s "Rotate" tlacidlom
  - Context menu sa zatvara na: pane click, Escape, po akcii
- Vytvorene `tests/utils/layout.test.ts` — 15 testov:
  - `nextRotation`: cely cyklus 0→90→180→270→0
  - `getInputPosition`: 4 rotacie → spravne Position enum values
  - `getOutputPosition`: 4 rotacie → spravne Position enum values
  - `isVerticalSide`: Left/Right = true, Top/Bottom = false
  - `getHandleDistributionStyle`: vertikalne strany → `{ top: pct }`, horizontalne strany → `{ left: pct }`
- Verifikacia: `tsc -b` zero errors, 67/67 testov OK (15 novych + 52 existujucich)

### Session 2026-02-04 (iteracia 9)
- Vytvorene `diffInterface()` v `src/engine/validate.ts`:
  - Porovnava stare a nove rozhranie modulu (inputs + outputs)
  - Matchuje piny podla ID (stabilne cez edity, lebo pinId patri InputNode/OutputNode)
  - Vracia `InterfaceDiff`: `added`, `removed`, `renamed`, `isBreaking` (removed.length > 0)
- Pridane standalone pure funkcie do `src/store/module-store.ts`:
  - `getModulesDependingOn(moduleId, modules)` — priami dependenti (moduly pouzivajuce dany modul)
  - `getTransitiveDependentsInOrder(moduleId, modules)` — BFS tranzitivni dependenti v dependency order (priame deti prvy, potom ich dependenti)
  - `synchronizeInstancesInCircuit(parent, changedModuleId, oldDef, newDef)` — aktualizuje vsetky instance nody v parent circuite:
    - Mapuje stare definition pin ID → instance pin (podla indexu)
    - Pre prezivajuce piny: reuse instance pin ID (zachova wiry), update name/direction
    - Pre nove piny: fresh generated ID
    - Pre odstranene piny: najde instance pin IDs, filtruje edges
  - `regenerateTruthTablesCascading(changedModuleId, modules)` — regeneruje truth table pre zmeneny modul + vsetkych tranzitivnych dependentov v spravnom poradi
- Refaktorovany save flow v `src/store/module-store.ts`:
  - `prepareSave()` → `SaveAnalysis` — validacia + diff detekcia + `needsConfirmation` ak breaking + su dependenti
  - `executeSave(analysis)` → `SaveResult` — update definicie, synchronize instances, cascading truth tables, mark clean
  - `saveCurrentModule()` — backward-compat wrapper (prepare + execute)
  - `executeModuleDelete(moduleId)` — odstrani vsetky instance nody z parent circuitov + ich wiry, zmaze modul, regeneruje truth tables, ak editujeme mazany modul → clear canvas
- Vytvorene `src/components/SaveModule/SaveWarningDialog.tsx`:
  - Reusable warning dialog s props: `title`, `message`, `removedPins`, `affectedModules`, `onConfirm`, `onCancel`
  - Zobrazuje zoznam removedPins a affectedModules
  - Pouzity pre breaking save aj pre delete warning (s inou title/message)
- Aktualizovane `src/components/Toolbar/Toolbar.tsx`:
  - `doSave()` vola `prepareSave()` namiesto `saveCurrentModule()`
  - Ak `needsConfirmation` → ulozi `saveAnalysis` do state → renderuje `SaveWarningDialog`
  - Na confirm → `executeSave(analysis)` → toast
  - Na cancel → `setSaveAnalysis(null)`
- Aktualizovane `src/components/Library/ModuleCard.tsx`:
  - Novy `onDelete` prop + "Del" button (vedla Edit, len pre non-builtin)
  - Hover efekt na delete button: cerveny bg
- Aktualizovane `src/components/Library/LibraryPanel.tsx`:
  - `handleDelete(moduleId)` — ak ziadni dependenti → silent delete; ak su dependenti → warning dialog
  - State `deleteTarget` pre delete warning dialog
  - Pouziva `SaveWarningDialog` s title "Delete module?" a custom message
- Pridane testy do `tests/engine/validate.test.ts` — 5 novych testov pre `diffInterface`:
  - Nezmenene rozhranie, pridane piny, odstranene piny (breaking), premenovane piny, mixed changes
- Vytvorene `tests/store/module-store.test.ts` — 10 novych testov:
  - `getModulesDependingOn`: prazdne dependenty, priami dependenti, nevracia tranzitivne
  - `getTransitiveDependentsInOrder`: prazdne, topologicke poradie (B pred C), neobsahuje root
  - `synchronizeInstancesInCircuit`: zachovanie pin IDs, odstranenie edges, generovanie fresh IDs, nemodifikuje ine nody
- Verifikacia: `tsc -b` zero errors, 52/52 testov OK

### Session 2026-02-03 (iteracia 8)
- Vytvorene `src/components/Library/ModuleCard.tsx` — `React.memo` karta modulu:
  - Zobrazuje nazov + pocet in/out pinov
  - Draggable (`onDragStart` s `application/nandforge-module` dataTransfer)
  - Klik na user-created modul → otvori na editaciu (NAND je needitovatelny)
- Vytvorene `src/components/Library/LibraryPanel.tsx`:
  - NAND vzdy prvy (built-in, virtualny Module objekt, needitovatelny, nemazatelny)
  - Pod nim user-created moduly z module-store
  - `handleOpen` — klik na modul → `setActiveModuleId` + `loadCircuit` s konverziou z engine typov
- Vytvorene `src/utils/circuit-converters.ts` — konverzne utility:
  - `circuitNodesToAppNodes(nodes, modules)` — engine CircuitNode[] → React Flow AppNode[]
    - Spravne odvodi constant value z pin name ("0"/"1")
    - Lookup module names pre module nody
  - `circuitEdgesToRFEdges(edges)` — engine Edge[] → React Flow Edge[] s manhattan typom
- Aktualizovane `src/store/circuit-store.ts`:
  - `addNode` rozsireny o volitelny `moduleData?: { label, pins }` parameter
  - Pre custom moduly: piny sa kopiuju s novymi ID (`generateId()`) a label z moduleData
  - Umoznuje drag & drop custom modulov z library bez circular dependency
- Aktualizovane `src/components/Canvas/Canvas.tsx`:
  - Pridane `onDragOver` (prevent default, copy effect) a `onDrop` handlery
  - Drop handler: cita moduleId z dataTransfer, lookup modul cez `getModuleById`, vytvori node s pinmi
  - NAND drop pouziva existujuci built-in flow, custom moduly posielaju `moduleData`
- Aktualizovane `src/store/simulation-store.ts`:
  - Import `useModuleStore`, `runSimulation` teraz pasa `modules` do `evaluateCircuitFull`
  - Custom module nody na canvase sa teraz spravne simuluju (truth table lookup alebo rekurzia)
- Aktualizovane `src/App.tsx` — nahradeny placeholder library panel za `<LibraryPanel />` komponent
- Verifikacia: `tsc -b` zero errors, `npm run build` OK, 37/37 testov OK

### Session 2026-02-03 (iteracia 7)
- Extrahovane `canvasToCircuit` z `simulation-store.ts` do `src/utils/canvas-to-circuit.ts` — shared utility pre simulation aj save flow
- Pridana pure funkcia `extractInterface(nodes)` do `circuit-store.ts` — extrahuje `{ inputs: Pin[], outputs: Pin[] }` z AppNode[]
- Rozsireny `circuit-store.ts` o 3 nove akcie:
  - `clearCanvas()` — reset nodes/edges na [], bump simulationVersion
  - `setActiveModuleId(moduleId)` — nastavi aktualny modul
  - `loadCircuit(nodes, edges)` — nahradi canvas obsah, bump simulationVersion
- Vytvorene `src/store/module-store.ts` — Zustand store:
  - `modules: Module[]` — zoznam ulozenych modulov
  - CRUD akcie: `addModule`, `updateModule`, `deleteModule`
  - Helper `getModuleById(id)` — cita cez `getState()`
  - `saveCurrentModule()` — kompletny save flow s validaciou:
    - Kontrola activeModuleId existencie
    - Min 1 circuitInput + 1 circuitOutput node
    - Nazov != "NAND" (case-insensitive)
    - `hasTransitiveSelfReference` check z `engine/validate.ts`
    - Warning (nie error) pre nepripojene Input/Output nody
    - Vola `extractInterface` → interface piny
    - Vola `canvasToCircuit` → engine circuit
    - Generuje truth table ak <=16 inputov
    - Vracia `{ success, warnings, errors }`
- Vytvorene `src/components/Toolbar/Toolbar.tsx`:
  - "NAND Forge" title + nazov aktivneho modulu (badge)
  - "New Module" tlacidlo → otvori dialog
  - "Save" tlacidlo → vola `saveCurrentModule()`
  - `Ctrl+S` / `Cmd+S` keyboard shortcut (useEffect + keydown listener)
  - Toast notifikacie (success/warning/error) s auto-dismiss po 3s
- Vytvorene `src/components/Toolbar/NewModuleDialog.tsx`:
  - Modal s input polom, auto-focus pri otvoreni
  - Enter = submit, Escape = cancel
  - Validacia: prazdny nazov, "NAND" guard
  - "Create" + "Cancel" tlacidla
- Aktualizovane `src/App.tsx` — nahradeny inline toolbar div za `<Toolbar />` komponent
- Aktualizovane `src/store/simulation-store.ts` — importuje `canvasToCircuit` zo shared utility, odstranena lokalna kopia
- Verifikacia: `tsc -b` zero errors, `npm run build` OK, 37/37 testov OK

### Session 2026-02-03 (iteracia 6)
- Refaktorovane `src/engine/simulate.ts`:
  - Nova funkcia `evaluateCircuitFull(circuit, inputs, modules)` — vracia `Map<string, boolean>` so VSETKYMI pin values (nodeId:pinId → value)
  - `evaluateCircuit` deleguje na `evaluateCircuitFull` a extrahuje len output node values (zachovane API, existujuce testy OK)
- Pridany `simulationVersion` do `src/store/circuit-store.ts`:
  - Counter inkrementovany pri kazdej simulacne-relevantnej mutacii (addNode, removeNode, addEdge, removeEdge, toggleInputValue, toggleConstantValue, onNodesChange s remove, onEdgesChange s remove)
  - Opraveny bug: `onNodesChange` s typom 'remove' teraz cisti pripojene edges (predtym ostali ovisete)
- Pridany `ProbeNodeData` a `ProbeNodeType` do circuit-store, `addNode` podporuje typ `probe`
- Vytvorene `src/store/simulation-store.ts` — Zustand store:
  - `pinValues: Record<string, boolean>` — vsetky pin values po simulacii
  - `edgeSignals: Record<string, boolean>` — signal pre kazdy edge (podla source output pin)
  - `runSimulation(nodes, edges)` — konvertuje AppNode[]/RFEdge[] na engine Circuit, vola `evaluateCircuitFull`, uklada vysledky
  - Interna funkcia `canvasToCircuit` — mapuje React Flow typy (circuitInput/circuitOutput/constant/probe/module) na engine typy (input/output/constant/probe/module)
- Vytvorene `src/hooks/useSimulation.ts`:
  - Sleduje `simulationVersion` z circuit store
  - Pri zmene cita nodes/edges cez `getState()` (bez subscribovania na drag/pan)
  - Vola `runSimulation` zo simulation store
- Aktualizovane `src/components/Canvas/ManhattanEdge.tsx`:
  - Cita signal z `useSimulationStore` podla edge ID namiesto edge data
  - Farba: seda (#71717a) pre 0, zelena (#34d399) pre 1, modra (#60a5fa) pre selected
- Aktualizovane `src/components/Canvas/OutputNode.tsx`:
  - Cita signal z `useSimulationStore` podla `pinKey(nodeId, pinId)`
  - LED svieti zelene pri signal=true, seda pri false
- Vytvorene `src/components/Canvas/ProbeNode.tsx`:
  - `React.memo` (P2), 1 target handle vlavo
  - Zobrazuje aktualnu hodnotu (0/1) z simulation store
  - Kompaktny debug nastroj — na rozdiel od Output nema meno a nesluzi ako interface pin
- Aktualizovane `src/components/Canvas/Canvas.tsx`:
  - Registrovany `probe: ProbeNode` v `nodeTypes` (mimo komponent, P1)
  - Pridane tlacidlo "+ Probe" v paneli
  - Volany `useSimulation()` hook v `CanvasInner`
- Verifikacia: `tsc -b` zero errors, `npm run build` OK, 37/37 testov OK

### Session 2026-02-03 (iteracia 5)
- Vytvorene `src/components/Canvas/ManhattanEdge.tsx` — custom edge komponent:
  - `React.memo` (P2), SVG Z-shape path (horizontal → vertical → horizontal)
  - Ak piny v rovnakej vyske → rovny wire (2-segmentovy)
  - Farba podla signalu: `#71717a` (seda, 0/neznamy), `#34d399` (zelena, 1), `#60a5fa` (modra, selected)
  - Signal sa cita z `data.signal` na edge — pripravene pre I6 (simulation store)
  - Exportovany `ManhattanEdgeType` pre typovanie
- Vytvorene `src/hooks/useWiring.ts` — wiring hook:
  - `isValidConnection(connection)` — validacia pred pripojenim:
    - Ziadne self-connections (source === target)
    - Handles musia byt specifikovane
    - Ziadne duplicitne edges (rovnaky source+sourceHandle → target+targetHandle)
    - Kazdy input pin moze mat max 1 pripojeny wire (one driver per input)
    - Cycle detection — BFS z target, ak dosiahneme source → cyklus → odmietnutie
  - `onConnect(connection)` — vytvori edge s `generateId()` a typom `manhattan`
  - Typ `IsValidConnection` z React Flow pre kompatibilitu s `Edge | Connection` union
- Aktualizovane `src/components/Canvas/Canvas.tsx`:
  - `edgeTypes` definovane mimo komponent (P1): `{ manhattan: ManhattanEdge }`
  - `defaultEdgeOptions = { type: 'manhattan' }` — vsetky nove wiry su manhattan
  - `onConnect` a `isValidConnection` z `useWiring()` hooku
  - Wire selekcia a mazanie funguje cez existujuce `deleteKeyCode` + `onEdgesChange`
- Verifikacia: `tsc -b` zero errors, `npm run build` OK, 37/37 testov OK

### Session 2026-02-03 (iteracia 4)
- Vytvorene `src/store/circuit-store.ts` — Zustand store:
  - Node/edge state s `applyNodeChanges`/`applyEdgeChanges`
  - `addNode` pre 4 typy: `circuitInput`, `circuitOutput`, `constant`, `module` (NAND)
  - `removeNode` s automatickym mazanim pripojenych edges
  - `toggleInputValue`, `toggleConstantValue`, `updateNodeLabel`
  - Typed AppNode union: `InputNodeType | OutputNodeType | ConstantNodeType | ModuleNodeType`
- Vytvorene node komponenty (vsetky `React.memo` — P2):
  - `InputNode.tsx` — toggle button (0/1), editovatelne meno (double-click), source handle vpravo
  - `OutputNode.tsx` — LED indikator (placeholder), editovatelne meno, target handle vlavo
  - `ConstantNode.tsx` — toggle 0/1 (amber), source handle vpravo
  - `ModuleNode.tsx` — dynamicke handles z `pins[]`, pin mena vedla handleov, label v strede
- Vytvorene `Canvas.tsx`:
  - `ReactFlowProvider` + `ReactFlow` s gridom (dots), pan, zoom
  - `nodeTypes` definovane mimo komponent (P1)
  - Panel s docasnymi tlacidlami: + Input, + Output, + Constant, + NAND
  - `screenToFlowPosition` pre umiestnenie novych nodov do stredu viewportu
- Aktualizovane `App.tsx` — layout shell:
  - Toolbar s nazvom "NAND Forge"
  - Library panel (placeholder)
  - Canvas area (flex-1)
- Rozhodnutie: RF node typy pouzivaju `circuitInput`/`circuitOutput` (nie `input`/`output`) aby sa predislo kolizii s React Flow built-in typmi
- Verifikacia: `tsc -b` zero errors, 37/37 testov OK

### Session 2026-02-03 (iteracia 3)
- Vytvorene `src/engine/truth-table.ts`:
  - `generateTruthTable(circuit, modules)` — iteruje vsetky 2^n input kombinacie, vola `evaluateCircuit`, vracia `TruthTable | null`
  - Threshold: > 16 inputov → vracia `null`
  - `lookupTruthTable(table, inputs)` — O(1) lookup podla input kluca
- Vytvorene `tests/engine/truth-table.test.ts` — 8 testov:
  - generateTruthTable: NOT (2 riadky), XOR z 4 NANDov (4 riadky), threshold > 16 → null, presne 16 → OK, prazdny circuit
  - lookupTruthTable: NOT lookup, XOR lookup, chybajuci riadok → false
- Rozsirene `tests/engine/simulate.test.ts` o 2 testy (module s truth table cache):
  - Input → NOT modul (s truth table) → Output
  - Double NOT (2x modul) → identita
- Poznamka: truth table cache lookup v `evaluateCircuit` bol uz implementovany v I2 (task 3.4 uz splneny)
- Verifikacia: 37/37 testov OK, `tsc -b` zero errors

### Session 2026-02-03 (iteracia 2)
- Vytvorene `src/engine/simulate.ts`:
  - `evaluateNand(a, b)` — `!(a && b)`
  - `BUILTIN_NAND_MODULE_ID` = `"builtin:nand"`
  - `pinKey(nodeId, pinId)` — kompozitny kluc pre mapy
  - `buildAdjacencyList(circuit)` — forward (fan-out) + reverse (fan-in) mapy
  - `topologicalSort(circuit)` — Kahnov algoritmus, throw pri cykle
  - `evaluateCircuit(circuit, inputs, modules?)` — seed inputs, propagacia cez topo order, NAND eval, custom module support (truth table lookup + rekurzia)
- Vytvorene `src/engine/validate.ts`:
  - `hasCycle(circuit)` — DFS three-color (WHITE/GRAY/BLACK)
  - `hasTransitiveSelfReference(moduleId, modules)` — BFS cez module grafy
- Vytvorene `tests/engine/simulate.test.ts` — 17 testov:
  - 4x NAND truth table, pinKey, adjacency list (forward, reverse, fan-out)
  - topologicalSort dependency order
  - evaluateCircuit: empty, pass-through, NOT (2 testy), AND (4 kombinacie), unconnected output
- Vytvorene `tests/engine/validate.test.ts` — 10 testov:
  - hasCycle: acyclic, cyclic A→B→C→A, self-loop, empty, disconnected
  - hasTransitiveSelfReference: mutual A↔B, direct, no-ref, nonexistent, chain A→B→C→A
- Verifikacia: 27/27 testov OK, `tsc -b` zero errors

### Session 2026-02-03 (planovanie)
- Vytvoreny tech-spec.md s kompletnou MVP specifikaciou (13 iteracii, ~90 taskov)
- Vytvoreny post-mvp-roadmap.md (iteracie 14–35, od CPU po platformu)
- Validovany React Flow (handles, manhattan routing, performance)
- Zmeneny snapshot model na reference-based
- NAND vizual zjednoteny s ostatnymi modulmi
- Zaradeny convenience komponenty (Constant, Probe, Button, Splitter/Merger, DIP switch, Hex display, LED bar, Tunnel)
- Zaradeny tri-state buffer medzi iteraciu 22 (RAM) a 24 (ALU)

### Session 2026-02-03 (iteracia 1)
- Nainstalovane dependencies: react, react-dom, @xyflow/react, zustand, typescript, tailwindcss, vitest
- Vytvorene tsconfig (project references), vite.config.ts (React + Tailwind + Vitest), .gitignore
- Vytvorene index.html, src/main.tsx, src/App.tsx (placeholder), src/index.css (Tailwind)
- Vytvorene src/engine/types.ts — vsetky core typy (NodeId, PinId, EdgeId, ModuleId, Pin, CircuitNode, Edge, Circuit, Module, TruthTable)
- Vytvorene src/utils/id.ts — generateId() cez crypto.randomUUID()
- Vytvorena projektova struktura (src/engine, store, components/*, hooks, utils, tests/engine)
- Overene: `bun run build` OK, `vitest run` OK (ziadne testy zatial)
