import Canvas from "./components/Canvas/Canvas.tsx";

export default function App() {
  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      {/* Toolbar */}
      <div className="flex h-10 items-center border-b border-zinc-700 px-4">
        <span className="text-sm font-bold">NAND Forge</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Library panel — placeholder */}
        <div className="flex w-44 flex-col border-r border-zinc-700 p-2">
          <span className="text-xs font-semibold text-zinc-400">Library</span>
          <span className="mt-2 text-[10px] text-zinc-500">
            Drag components here in a future iteration.
          </span>
        </div>

        {/* Canvas */}
        <div className="flex-1">
          <Canvas />
        </div>
      </div>
    </div>
  );
}
