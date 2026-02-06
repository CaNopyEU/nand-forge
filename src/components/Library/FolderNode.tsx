import { useState, useCallback } from "react";
import { useLibraryStore } from "../../store/library-store.ts";

type DropZone = "before" | "inside" | "after" | null;

interface FolderNodeProps {
  folderId: string;
  name: string;
  collapsed: boolean;
  children: React.ReactNode;
  parentFolderId?: string | null;
  indexInParent?: number;
  onReorder?: (moduleId: string, targetFolderId: string | null, insertIndex: number) => void;
}

export function FolderNode({
  folderId,
  name,
  collapsed,
  children,
  parentFolderId,
  indexInParent,
  onReorder,
}: FolderNodeProps) {
  const toggleCollapse = useLibraryStore((s) => s.toggleCollapse);
  const renameFolder = useLibraryStore((s) => s.renameFolder);
  const deleteFolder = useLibraryStore((s) => s.deleteFolder);
  const moveModuleToFolder = useLibraryStore((s) => s.moveModuleToFolder);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [dropZone, setDropZone] = useState<DropZone>(null);

  const handleDoubleClick = useCallback(() => {
    setEditName(name);
    setEditing(true);
  }, [name]);

  const handleRenameConfirm = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== name) {
      renameFolder(folderId, trimmed);
    }
    setEditing(false);
  }, [editName, name, folderId, renameFolder]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleRenameConfirm();
      if (e.key === "Escape") setEditing(false);
    },
    [handleRenameConfirm],
  );

  const locked = useLibraryStore((s) => s.locked);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (locked) return;
    if (!e.dataTransfer.types.includes("application/nandforge-library-item")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const ratio = y / rect.height;

    if (ratio < 0.25 && indexInParent !== undefined && onReorder) {
      setDropZone("before");
    } else if (ratio > 0.75 && indexInParent !== undefined && onReorder) {
      setDropZone("after");
    } else {
      setDropZone("inside");
    }
  }, [locked, indexInParent, onReorder]);

  const handleDragLeave = useCallback(() => {
    setDropZone(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const zone = dropZone;
      setDropZone(null);
      const moduleId = e.dataTransfer.getData("application/nandforge-library-item");
      if (!moduleId) return;

      if (zone === "before" && onReorder && indexInParent !== undefined) {
        onReorder(moduleId, parentFolderId ?? null, indexInParent);
      } else if (zone === "after" && onReorder && indexInParent !== undefined) {
        onReorder(moduleId, parentFolderId ?? null, indexInParent + 1);
      } else {
        // "inside" or fallback — append into folder
        moveModuleToFolder(moduleId, folderId);
      }
    },
    [dropZone, folderId, moveModuleToFolder, onReorder, parentFolderId, indexInParent],
  );

  const dropClass =
    dropZone === "before"
      ? "border-t-2 border-t-blue-500"
      : dropZone === "after"
        ? "border-b-2 border-b-blue-500"
        : dropZone === "inside"
          ? "bg-blue-900/30 ring-1 ring-blue-500/50"
          : "";

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded px-1 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700/50 ${dropClass}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button
          onClick={() => toggleCollapse(folderId)}
          className="w-4 text-center text-[10px]"
        >
          {collapsed ? "\u25B6" : "\u25BC"}
        </button>

        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRenameConfirm}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded bg-zinc-900 px-1 text-xs text-zinc-200 outline-none"
          />
        ) : (
          <span
            className="flex-1 cursor-default font-medium"
            onDoubleClick={handleDoubleClick}
          >
            {name}
          </span>
        )}

        <button
          onClick={() => deleteFolder(folderId)}
          className="rounded px-1 text-[10px] text-zinc-500 hover:text-red-400"
          title="Delete folder (children move up)"
        >
          x
        </button>
      </div>

      {!collapsed && (
        <div className="ml-3 flex flex-col gap-0.5">
          {children}
        </div>
      )}
    </div>
  );
}
