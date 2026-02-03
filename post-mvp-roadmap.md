# NAND Forge — Post-MVP Roadmap

Tento dokument navazuje na `tech-spec.md` (iteracie 1–13, MVP).
Popisuje dalsie iteracie po MVP smerujuce od kombinacnych obvodov az ku kompletne
funkcnemu CPU a beyond.

---

## Prehladova mapa

```
MVP (iteracie 1–13)
  └─ Kombinacne obvody: NAND → NOT → AND → OR → XOR → Adder → ALU

Post-MVP Faza A: Sekvencne obvody
  └─ Clock, Button (pulse), Flip-Flopy, Registre, Counter

Post-MVP Faza B: Multi-bit & UX
  └─ Bus wiring, Splitter/Merger, DIP switch, Hex display, LED bar, Tunnel/Label, Undo/Redo, Drill-down

Post-MVP Faza C: Pamat
  └─ RAM, ROM, Adresovanie, Tri-state buffer

Post-MVP Faza D: CPU
  └─ Program Counter, Instruction Decoder, Control Unit, CPU

Post-MVP Faza E: Programovanie
  └─ Assembler, Program Editor, Step debugging

Post-MVP Faza F: I/O & Periférie
  └─ Display, Klavesnica, UART

Post-MVP Faza G: Platforma & Komunita
  └─ Mobile/tablet, Cloud, Zdielanie, Tutorialy
```

---

## Faza A — Sekvencne obvody (clock + feedback loops)

**Predpoklad:** MVP hotove (iteracie 1–13).
**Odomkne:** Flip-flopy, registre, countery — zaklad pre vsetko co si "pamata" stav.

### Iteracia 14 — Clock source + Button

| # | Task | Popis |
|---|---|---|
| 14.1 | Clock node typ | Novy built-in node: `clock`. Generuje periodicky signal 0→1→0→1. |
| 14.2 | Clock konfiguracia | User nastavi frekvenciu (tick-per-second): napr. 1 Hz, 10 Hz, 100 Hz. |
| 14.3 | Taktovana simulacia | Novy simulacny mode: engine evaluuje cely obvod raz za clock tick (namiesto event-driven). |
| 14.4 | Play / Pause / Step | Toolbar tlacidla: Play (bezi automaticky), Pause (zastavenie), Step (1 tick manualne). |
| 14.5 | Clock vizual | Clock node zobrazuje aktualny stav (0/1) a blikajuci indikator. |
| 14.6 | Button (pulse) node | Novy built-in node: `button`. 1 source handle. Vystup = 1 len kym user drzi tlacidlo, inak 0. Na rozdiel od Input toggle (ktory drzi stav): Button je momentany — pouzitie pre manual clock trigger, reset signaly, testovanie sekvencnych obvodov. |
| 14.7 | Clock + Button v library | Clock a Button sa pridaju do built-in sekcie library panelu. |

### Iteracia 15 — Kontrolovane cykly (feedback loops)

| # | Task | Popis |
|---|---|---|
| 15.1 | Propagation delay model | Kazdy gate/modul ma delay = 1 tick. Signal sa nepropaguje okamzite ale az v dalsom ticku. |
| 15.2 | Povolenie cyklov | Upravit validaciu: cykly su povolene AK obvod obsahuje clock. Bez clocku cykly stale zakazane. |
| 15.3 | Stabilizacia detekcia | Pri evaluacii ticku: detekuj ci sa obvod stabilizoval (ziadne zmeny) alebo osciluje. Max N iteracii. |
| 15.4 | Oscilacia warning | Ak sa obvod nestabilizuje → vizualne oznacenie nestabilnych wirov (napr. blikanie, cervena farba). |
| 15.5 | Testy cykly | Unit testy: SR latch z 2 NAND gates s feedback loop — overenie stabilnych stavov. |

### Iteracia 16 — Flip-Flopy a Registre

| # | Task | Popis |
|---|---|---|
| 16.1 | SR Flip-Flop | User postavi SR latch z 2 NAND gates (feedback). Ulozi ako modul. Test: Set, Reset, Hold. |
| 16.2 | D Flip-Flop | User postavi z SR FF + clock gating. Ulozi ako modul. Test: data sa zachyti na rising edge. |
| 16.3 | JK Flip-Flop | User postavi z NAND gates. Ulozi ako modul. |
| 16.4 | Edge detection | Podpora pre rising-edge / falling-edge triggering v simulacii. |
| 16.5 | 8-bit Register | User postavi z 8x D Flip-Flop. Ulozi ako modul. Test: load 8-bit hodnotu, hold. |
| 16.6 | Counter | User postavi 4-bit counter z flip-flopov. Ulozi ako modul. Test: pocita 0→15→0. |
| 16.7 | Timing diagram view | Novy view: zobrazenie signalov v case (waveform). Horizontalna os = tick, vertikalna = 0/1. |

---

## Faza B — Multi-bit & UX

**Predpoklad:** Faza A hotova.
**Odomkne:** Pohodlna praca s 8-bit a 16-bit signalmi, profesionalnejsie UX.

### Iteracia 17 — Multi-bit bus + convenience I/O

| # | Task | Popis |
|---|---|---|
| 17.1 | Multi-bit pin typ | Rozsirenie `Pin.bits` z fixneho `1` na `1 | 4 | 8 | 16`. |
| 17.2 | Bus wire rendering | Bus wire = hrubsia ciara, zobrazuje hex hodnotu (napr. "0xA3"). |
| 17.3 | Bus Input/Output nody | Input node s bitovou sirkou: 8 togglerov alebo hex input. Output node zobrazuje hex/bin/dec. |
| 17.4 | Splitter / Merger | Novy built-in: Splitter (n-bit → nx 1-bit), Merger (nx 1-bit → n-bit). Konfigurovatelna sirka. |
| 17.5 | Bus validacia | Wire medzi pinmi ruznej sirky → error. Splitter/Merger povinny. |
| 17.6 | Bus simulacia | Engine rozsirenie: propagacia multi-bit hodnot (number namiesto boolean). |
| 17.7 | Existujuce moduly kompatibilita | 1-bit moduly (NOT, AND, XOR...) funguju na 1-bit pinoch. Bus je len pre nove moduly. |
| 17.8 | DIP switch node | Built-in: skupina 4/8 togglerov v jednom node. Vystup: multi-bit (4/8-bit). Kompaktnejsie nez 8 samostatnych Input nodov. |
| 17.9 | Hex display node | Built-in: 1 target handle (8-bit). Zobrazuje hodnotu v hex/bin/dec formate. Kompaktnejsie nez 8 Output nodov. |
| 17.10 | LED bar node | Built-in: 1 target handle (8-bit). 8 LEDiek v rade, kazda zobrazuje 1 bit. Vizualne intuitivnejsie pre binarnu hodnotu. |
| 17.11 | Tunnel / Label node | Built-in: pomenovaný "wireless wire". Dva Tunnel nody s rovnakym menom su logicky prepojene bez viditelneho wiru. Redukuje vizualny chaos pri velkych obvodoch. Implementacia: engine ich spoji ako virtualnu edge. |

### Iteracia 18 — Undo/Redo

| # | Task | Popis |
|---|---|---|
| 18.1 | Command pattern | Kazda akcia (add node, remove node, add edge, move node...) = command objekt s `execute()` a `undo()`. |
| 18.2 | History stack | Undo stack + redo stack v circuit store. |
| 18.3 | Ctrl+Z / Ctrl+Shift+Z | Keyboard shortcuts. |
| 18.4 | Undo/Redo tlacidla | V toolbare. Disabled ked stack prazdny. |
| 18.5 | Batch operations | Presun viacerych nodov = 1 undo step, nie N. |

### Iteracia 19 — Drill-down do modulov

| # | Task | Popis |
|---|---|---|
| 19.1 | Dvojklik na modul | Dvojklik na ModuleNode → otovri jeho vnutornu logiku na canvase (read-only alebo edit mode). |
| 19.2 | Breadcrumb navigacia | Toolbar: "CPU > ALU > Full Adder > NAND". Klik na uroven → vrat sa. |
| 19.3 | Read-only view | Ak otvoris modul cez drill-down (nie cez library) → defaultne read-only, tlacidlo "Edit". |
| 19.4 | Highlight aktualnych hodnot | V drill-down view: wiry a nody zobrazuju aktualne simulacne hodnoty z rodica. |

### Iteracia 20 — Vizualne customizovanie

| # | Task | Popis |
|---|---|---|
| 20.1 | Farba modulu | User moze nastavit farbu pozadia bloku (napr. cervena pre ALU, modra pre registre). |
| 20.2 | Ikona modulu | Volitelna ikona v bloku (set preddefinovanych ikon). |
| 20.3 | Popis modulu | Textovy popis/komentar k modulu (zobrazuje sa v tooltip a library). |
| 20.4 | Custom velkost bloku | User moze zmenit velkost obdlznika (auto-resize podla pinov, alebo manualny override). |

---

## Faza C — Pamat + Tri-state buffer

**Predpoklad:** Faza A + B (sekvencne obvody + bus).
**Odomkne:** RAM, ROM, zdielana zbernica — bez pamati a zbernice nie je CPU.

### Iteracia 21 — ROM (Read-Only Memory)

| # | Task | Popis |
|---|---|---|
| 21.1 | ROM modul koncept | Built-in alebo user-buildable: adresovy vstup (n-bit) → datovy vystup (8-bit). Obsah fixny. |
| 21.2 | ROM editor | Tabulkovy editor: user vyplni hodnoty pre kazdu adresu (hex). |
| 21.3 | ROM simulacia | Address input → lookup v tabulke → data output. Kombinacny (nepotrebuje clock). |
| 21.4 | ROM import/export | Moznost importovat obsah ROM z textoveho suboru (hex dump). |

### Iteracia 22 — RAM (Random Access Memory)

| # | Task | Popis |
|---|---|---|
| 22.1 | RAM modul koncept | Vstupy: address (n-bit), data-in (8-bit), write-enable (1-bit), clock. Vystup: data-out (8-bit). |
| 22.2 | RAM built-in vs user-built | Pre prakticke ucely: RAM ako built-in modul (user by musel postavit stovky flip-flopov). Konfigurovatelna velkost (16x8, 256x8). |
| 22.3 | RAM simulacia | Na rising edge clocku: ak write-enable=1 → zapis data-in na address. Data-out vzdy zobrazuje hodnotu na address. |
| 22.4 | RAM content viewer | Panel: zobrazenie obsahu RAM v realnom case (tabulka adresa → hodnota). Highlight posledny zapis. |
| 22.5 | RAM content import | Moznost predvyplnit RAM obsahom (napr. program pre CPU). |

---

### Iteracia 23 — Tri-state buffer & zdielana zbernica

| # | Task | Popis |
|---|---|---|
| 23.1 | Treti stav v engine | Rozsirenie simulacie: hodnota na wire nie je len `boolean` ale `0 \| 1 \| Z` (high-impedance). Novy typ `type WireValue = 0 \| 1 \| 'Z'`. |
| 23.2 | Bus resolution logika | Ak viacero vystupov pripojeny na jeden wire: vsetky Z okrem jedneho → hodnota toho jedneho. Viacero non-Z → **conflict error** (vizualne oznacenie). |
| 23.3 | Tri-state buffer node | Novy built-in node: vstupy `data` (1-bit) + `enable` (1-bit), vystup (1-bit). Enable=1 → vystup=data, Enable=0 → vystup=Z. |
| 23.4 | Multi-bit tri-state | Varianta pre 8-bit: 8-bit data + 1-bit enable → 8-bit vystup. |
| 23.5 | Pull-up / Pull-down | Built-in nody: Pull-up (wire defaultne 1 ak Z), Pull-down (wire defaultne 0 ak Z). Potrebne pre bus ktory nema aktivny driver. |
| 23.6 | Tri-state v library | Pridanie do built-in sekcie library panelu. |
| 23.7 | Conflict vizualizacia | Wire v conflict stave (viacero driverov) → cervena farba + warning icon. |
| 23.8 | Testy tri-state | Unit testy: Z propagacia, bus resolution (1 active + rest Z = OK), conflict detection (2 active = error). |
| 23.9 | Spätna kompatibilita | Existujuce obvody bez tri-state funguju rovnako — wire hodnoty 0/1 sa nemenia. Z stav sa objavi len pri pouziti tri-state bufferov. |

---

## Faza D — CPU

**Predpoklad:** Fazy A–C (vsetko vyssie) + tri-state buffer.
**Odomkne:** Plne funkcny procesor schopny vykonavat program.

### Iteracia 24 — ALU (ak este nebol postaveny)

| # | Task | Popis |
|---|---|---|
| 24.1 | 8-bit ALU | Vstupy: A (8-bit), B (8-bit), opcode (4-bit). Vystupy: result (8-bit), carry, zero, negative flags. |
| 24.2 | Operacie | ADD, SUB, AND, OR, XOR, NOT, SHL, SHR (8 operacii = 3-bit opcode minimum). |
| 24.3 | ALU test | Overenie: 5 + 3 = 8, 255 + 1 = 0 (overflow), bitove operacie. |

### Iteracia 25 — Program Counter & Instruction Decoder

| # | Task | Popis |
|---|---|---|
| 25.1 | Program Counter (PC) | 8-bit register ktory sa automaticky inkrementuje kazdy tick. Vstupy: load (skok), reset. |
| 25.2 | Instruction format | Definicia instrukcie: napr. [opcode 4-bit][operand 4-bit] = 8-bit instrukcia. Alebo 16-bit pre vacsiu flexibilitu. |
| 25.3 | Instruction Decoder | Modul: instrukcia na vstupe → riadiace signaly na vystupe (alu_op, reg_write, mem_read, jump, ...). |
| 25.4 | Instruction set | Definicia ISA (Instruction Set Architecture): LOAD, STORE, ADD, SUB, AND, OR, JMP, JZ, HALT. |

### Iteracia 26 — Control Unit & CPU zostavenie

| # | Task | Popis |
|---|---|---|
| 26.1 | Control Unit | State machine: Fetch → Decode → Execute → Writeback. Ridi dataflow medzi komponentmi. |
| 26.2 | Register file | 4 alebo 8 general-purpose registrov (R0–R3/R7). Read port, write port. |
| 26.3 | CPU datapath | Prepojenie: PC → ROM (fetch) → Decoder → ALU/Registers/RAM → Writeback. |
| 26.4 | CPU modul | Cely CPU ako jeden modul: clock in, ROM obsah, RAM, output pins pre debugging. |
| 26.5 | CPU test | Jednoduchy program: nacitaj 2 cisla z RAM, scitaj ich, uloz vysledok. Overenie spravnosti. |

---

## Faza E — Programovanie

**Predpoklad:** Faza D (funkcny CPU).
**Odomkne:** Pohodlne programovanie CPU bez manualneho plnenia ROM.

### Iteracia 27 — Assembler

| # | Task | Popis |
|---|---|---|
| 27.1 | Assembly syntax | Definicia syntaxe: `LOAD R0, #5`, `ADD R0, R1`, `STORE R0, [0x10]`, `JMP label`, `HALT`. |
| 27.2 | Assembler engine | Parser: assembly text → pole bajtov (machine code). Pure TS, ziadne React zavislosti. |
| 27.3 | Label support | Assembler rozlisi labels (`loop:`, `end:`) a prepocita adresy. |
| 27.4 | Error reporting | Chybove hlasky s cislom riadku: "Line 5: Unknown instruction 'MLOAD'". |
| 27.5 | Testy assembler | Unit testy: jednoduche programy → spravny machine code. |

### Iteracia 28 — Program Editor

| # | Task | Popis |
|---|---|---|
| 28.1 | Code editor panel | Textovy editor s monospace fontom, cisla riadkov. |
| 28.2 | Syntax highlighting | Farebne odlisenie: instrukcie, registre, cisla, labels, komentare. |
| 28.3 | Assemble & Load | Tlacidlo: "Assemble" → skompiluje → nacita do ROM CPU → spusti simulaciu. |
| 28.4 | Error highlighting | Chybne riadky podciarknuty cervenou, tooltip s popisom chyby. |
| 28.5 | Program ukladanie | Program (assembly text) sa uklada ako sucast projektu (localStorage + export). |

### Iteracia 29 — Debugging

| # | Task | Popis |
|---|---|---|
| 29.1 | Step-by-step execution | Tlacidlo "Step" → CPU vykona 1 instrukciu. Zobrazenie aktualneho stavu (PC, registre, flags). |
| 29.2 | Breakpoints | Klik na cislo riadku → breakpoint. CPU sa zastavi ked PC dosiahne breakpoint adresu. |
| 29.3 | Register watch | Panel: aktualne hodnoty vsetkych registrov, aktualizovane po kazdom stepe. |
| 29.4 | Memory watch | Panel: obsah RAM, highlight zmenene bunky. |
| 29.5 | Execution trace | Log vykonanych instrukcii: `[tick 42] PC=0x05: ADD R0, R1 → R0=0x0A`. |

---

## Faza F — I/O & Periferie

**Predpoklad:** Faza D–E (CPU + programovanie).
**Odomkne:** Interakcia CPU s vonkajsim svetom.

### Iteracia 30 — Display output

| # | Task | Popis |
|---|---|---|
| 30.1 | 7-segment display | Built-in modul: 4-bit vstup → zobrazenie cisla 0–F na 7-segmentovom displeji. |
| 30.2 | LED matrix | Built-in: 8x8 grid LEDiek, kazda 1 bit. Adresovatelne cez riadok + stlpec + data. |
| 30.3 | Character display | Built-in: 8-bit vstup → ASCII znak. Riadok po riadku (napr. 16x2 LCD). |
| 30.4 | Memory-mapped I/O | Specificke adresy v RAM mapovane na display (napr. 0xF0–0xFF = screen buffer). |

### Iteracia 31 — Klavesnica input

| # | Task | Popis |
|---|---|---|
| 31.1 | Keypad modul | Built-in: 4x4 matica tlacidiel (0–9, A–F). Vystup: 4-bit keycode + key-pressed signal. |
| 31.2 | Key buffer | FIFO buffer: stlacene klavesy sa radia, CPU cita po jednom. |
| 31.3 | Memory-mapped input | Specificka adresa v RAM: read → vrati keycode z bufferu. |

### Iteracia 32 — UART (Serial communication)

| # | Task | Popis |
|---|---|---|
| 32.1 | UART TX modul | Built-in: 8-bit data + send signal → seriovy vystup (vizualizovany ako terminal output). |
| 32.2 | UART RX modul | Built-in: seriovy vstup → 8-bit data + data-ready signal. |
| 32.3 | Terminal panel | Novy panel: textovy terminal — vystup z UART TX sa zobrazuje ako text, vstup z klavesnice ide do UART RX. |

---

## Faza G — Platforma & Komunita

**Predpoklad:** Stabilne MVP+.
**Odomkne:** Sirsi pouzitelnost, zdielanie, vzdelavanie.

### Iteracia 33 — Mobile/Tablet

| # | Task | Popis |
|---|---|---|
| 33.1 | Touch interakcie | Pinch-to-zoom, 2-finger pan, tap-to-select, long-press context menu. |
| 33.2 | Responsive layout | Collapsible library panel, fullscreen canvas na malom displeji. |
| 33.3 | Touch-friendly handles | Zvacsene touch targets (min 44px), vizualny feedback pri dotyku. |
| 33.4 | Mobile wiring UX | Tap pin → tap pin (namiesto drag). Zoom-to-pin helper. |

### Iteracia 34 — Cloud & Zdielanie

| # | Task | Popis |
|---|---|---|
| 34.1 | User accounts | Registracia/prihlasenie (OAuth — Google, GitHub). |
| 34.2 | Cloud save | Projekty sa ukladaju na server (API + databaza). |
| 34.3 | Share link | Kazdy projekt/modul ma unikatnu URL. Read-only zdielanie. |
| 34.4 | Fork/Clone | User moze forknut zdielany projekt a editovat vlastnu kopiu. |
| 34.5 | Public gallery | Prehliadanie a vyhladavanie zdielanych modulov/projektov komunity. |

### Iteracia 35 — Tutorialy & Gamifikacia

| # | Task | Popis |
|---|---|---|
| 35.1 | Guided tutorials | Krok-po-kroku tutorialy: "Postav NOT gate", "Postav ALU", "Postav CPU". |
| 35.2 | Challenge mode | Zadanie: "Postav XOR gate pouzitim max 4 NAND gates" → validacia spravnosti. |
| 35.3 | Achievement system | Achievementy: "First Gate", "First Module", "Built a CPU", "Hello World program". |
| 35.4 | Module marketplace | Komunita zdielane moduly: user moze importovat hotove moduly od inych (napr. "8-bit ALU by user123"). |

---

## Sumar iteracii

| Faza | Iteracie | Popis | Odomkne |
|---|---|---|---|
| **MVP** | 1–13 | Kombinacne obvody, NAND → moduly | ALU |
| **A** | 14–16 | Sekvencne obvody | Flip-Flopy, Registre, Counter |
| **B** | 17–20 | Multi-bit bus, UX | Pohodlna praca s 8/16-bit, Undo/Redo |
| **C** | 21–23 | Pamat + Tri-state buffer | RAM, ROM, zdielana zbernica |
| **D** | 24–26 | CPU | Funkcny 8-bit procesor |
| **E** | 27–29 | Programovanie | Assembler, Debugger |
| **F** | 30–32 | I/O & Periferie | Display, Klavesnica, UART |
| **G** | 33–35 | Platforma & Komunita | Mobile, Cloud, Tutorialy |

## Milestone checkpointy

| Milestone | Po iteracii | User dokaze |
|---|---|---|
| **Kombinacny builder** | 13 (MVP) | Postavit ALU z NAND gates |
| **Sekvencny builder** | 16 | Postavit registre, countery, state machines |
| **Pamatovy builder** | 23 | Postavit kompletnu pamatovu hierarchiu so zdielanou zbernicou |
| **Funkcny CPU** | 26 | Postavit 8-bit CPU ktory vykonava program z ROM |
| **Programovatelny CPU** | 29 | Pisat assembly, debugovat, step-by-step |
| **Kompletny system** | 32 | CPU s displayom, klavesnicou, terminalom |
| **Platforma** | 35 | Zdielanie, tutorialy, komunita |
