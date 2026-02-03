import Canvas from "./components/Canvas/Canvas.tsx";
import { Toolbar } from "./components/Toolbar/Toolbar.tsx";
import { LibraryPanel } from "./components/Library/LibraryPanel.tsx";

export default function App() {
  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      {/* Toolbar */}
      <Toolbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Library panel */}
        <LibraryPanel />

        {/* Canvas */}
        <div className="flex-1">
          <Canvas />
        </div>
      </div>
    </div>
  );
}
