import { useState, useCallback } from "react";
import { useLibraryStore } from "../../store/library-store.ts";

interface FolderNodeProps {
  folderId: string;
  name: string;
  collapsed: boolean;
  children: React.ReactNode;
}

export function FolderNode({ folderId, name, collapsed, children }: FolderNodeProps) {
  const toggleCollapse = useLibraryStore((s) => s.toggleCollapse);
  const renameFolder = useLibraryStore((s) => s.renameFolder);
  const deleteFolder = useLibraryStore((s) => s.deleteFolder);
  const moveModuleToFolder = useLibraryStore((s) => s.moveModuleToFolder);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [dragOver, setDragOver] = useState(false);

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
    if (e.dataTransfer.types.includes("application/nandforge-library-item")) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setDragOver(true);
    }
  }, [locked]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const moduleId = e.dataTransfer.getData("application/nandforge-library-item");
      if (moduleId) {
        moveModuleToFolder(moduleId, folderId);
      }
    },
    [folderId, moveModuleToFolder],
  );

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded px-1 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700/50 ${dragOver ? "bg-blue-900/30 ring-1 ring-blue-500/50" : ""}`}
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
