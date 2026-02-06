import { useLibraryStore, type LibraryNode } from "../../store/library-store.ts";
import { getModuleById } from "../../store/module-store.ts";
import { ModuleCard } from "./ModuleCard.tsx";
import { FolderNode } from "./FolderNode.tsx";

interface LibraryTreeProps {
  onOpen: (moduleId: string) => void;
  onDelete: (moduleId: string) => void;
  forbiddenIds: Set<string>;
  onReorder: (moduleId: string, targetFolderId: string | null, insertIndex: number) => void;
}

function RenderNode({
  node,
  onOpen,
  onDelete,
  forbiddenIds,
  parentFolderId,
  indexInParent,
  locked,
  onReorder,
}: {
  node: LibraryNode;
  onOpen: (moduleId: string) => void;
  onDelete: (moduleId: string) => void;
  forbiddenIds: Set<string>;
  parentFolderId: string | null;
  indexInParent: number;
  locked: boolean;
  onReorder: (moduleId: string, targetFolderId: string | null, insertIndex: number) => void;
}) {
  if (node.type === "module") {
    const mod = getModuleById(node.moduleId);
    if (!mod) return null;
    return (
      <ModuleCard
        module={mod}
        onOpen={onOpen}
        onDelete={onDelete}
        disabled={forbiddenIds.has(mod.id)}
        parentFolderId={parentFolderId}
        indexInParent={indexInParent}
        locked={locked}
        onReorder={onReorder}
      />
    );
  }

  return (
    <FolderNode
      folderId={node.id}
      name={node.name}
      collapsed={node.collapsed}
      parentFolderId={parentFolderId}
      indexInParent={indexInParent}
      onReorder={onReorder}
    >
      {node.children.map((child, i) => (
        <RenderNode
          key={child.type === "folder" ? child.id : child.moduleId + i}
          node={child}
          onOpen={onOpen}
          onDelete={onDelete}
          forbiddenIds={forbiddenIds}
          parentFolderId={node.id}
          indexInParent={i}
          locked={locked}
          onReorder={onReorder}
        />
      ))}
    </FolderNode>
  );
}

export function LibraryTree({ onOpen, onDelete, forbiddenIds, onReorder }: LibraryTreeProps) {
  const tree = useLibraryStore((s) => s.tree);
  const locked = useLibraryStore((s) => s.locked);

  return (
    <>
      {tree.map((node, i) => (
        <RenderNode
          key={node.type === "folder" ? node.id : node.moduleId + i}
          node={node}
          onOpen={onOpen}
          onDelete={onDelete}
          forbiddenIds={forbiddenIds}
          parentFolderId={null}
          indexInParent={i}
          locked={locked}
          onReorder={onReorder}
        />
      ))}
    </>
  );
}
