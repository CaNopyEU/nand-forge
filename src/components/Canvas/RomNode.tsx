import { memo, useState } from "react";
import { Handle, type NodeProps } from "@xyflow/react";
import type { RomNodeType } from "../../store/circuit-store.ts";
import { getInputPosition, getOutputPosition } from "../../utils/layout.ts";
import { useSimulationStore } from "../../store/simulation-store.ts";
import { pinKey } from "../../engine/simulate.ts";
import { RomEditorDialog } from "./RomEditorDialog.tsx";

function RomNodeComponent({ id, data, selected }: NodeProps<RomNodeType>) {
  const [editorOpen, setEditorOpen] = useState(false);

  const addrSignal = useSimulationStore(
    (s) => s.pinValues[pinKey(id, data.addrPinId)] ?? 0,
  );
  const dataSignal = useSimulationStore(
    (s) => s.pinValues[pinKey(id, data.dataPinId)] ?? 0,
  );

  const addrDigits = Math.ceil(data.addressBits / 4);
  const addrHex = addrSignal.toString(16).toUpperCase().padStart(addrDigits, "0");
  const dataHex = dataSignal.toString(16).toUpperCase().padStart(2, "0");

  return (
    <>
      <div
        className={`flex min-w-[88px] flex-col items-center gap-0.5 rounded border bg-zinc-800 px-3 py-2 ${
          selected ? "border-blue-500" : "border-purple-700"
        }`}
      >
        <Handle
          type="target"
          position={getInputPosition(data.rotation ?? 0)}
          id={data.addrPinId}
        />
        <Handle
          type="source"
          position={getOutputPosition(data.rotation ?? 0)}
          id={data.dataPinId}
        />

        <span className="text-[10px] font-bold text-purple-300">ROM</span>
        <span className="text-[9px] text-zinc-500">{data.addressBits}-bit addr</span>

        <div className="mt-0.5 flex gap-2 font-mono text-[9px] text-zinc-300">
          <span className="text-zinc-500">@{addrHex}</span>
          <span>→ {dataHex}</span>
        </div>

        {/* nodrag prevents node dragging when clicking the button */}
        <button
          className="nodrag mt-1 rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-300 hover:bg-zinc-600"
          onClick={(e) => {
            e.stopPropagation();
            setEditorOpen(true);
          }}
        >
          Edit
        </button>
      </div>

      {editorOpen && (
        <RomEditorDialog
          nodeId={id}
          addressBits={data.addressBits}
          romData={data.romData}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </>
  );
}

export const RomNode = memo(RomNodeComponent);
