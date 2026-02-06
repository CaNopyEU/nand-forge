import { useLibraryStore, type LibraryNode } from "../../store/library-store.ts";
import { getModuleById } from "../../store/module-store.ts";
import { ModuleCard } from "./ModuleCard.tsx";
import { FolderNode } from "./FolderNode.tsx";

interface LibraryTreeProps {
  onOpen: (moduleId: string) => void;
  onDelete: (moduleId: string) => void;
  forbiddenIds: Set<string>;
}

function RenderNode({
  node,
  onOpen,
  onDelete,
  forbiddenIds,
}: {
  node: LibraryNode;
  onOpen: (moduleId: string) => void;
  onDelete: (moduleId: string) => void;
  forbiddenIds: Set<string>;
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
      />
    );
  }

  return (
    <FolderNode
      folderId={node.id}
      name={node.name}
      collapsed={node.collapsed}
    >
      {node.children.map((child, i) => (
        <RenderNode
          key={child.type === "folder" ? child.id : child.moduleId + i}
          node={child}
          onOpen={onOpen}
          onDelete={onDelete}
          forbiddenIds={forbiddenIds}
        />
      ))}
    </FolderNode>
  );
}

export function LibraryTree({ onOpen, onDelete, forbiddenIds }: LibraryTreeProps) {
  const tree = useLibraryStore((s) => s.tree);

  return (
    <>
      {tree.map((node, i) => (
        <RenderNode
          key={node.type === "folder" ? node.id : node.moduleId + i}
          node={node}
          onOpen={onOpen}
          onDelete={onDelete}
          forbiddenIds={forbiddenIds}
        />
      ))}
    </>
  );
}
