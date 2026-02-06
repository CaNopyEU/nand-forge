import { create } from "zustand";
import type { ModuleId } from "../engine/types.ts";
import { generateId } from "../utils/id.ts";

// === Data model ===

export interface LibraryFolder {
  type: "folder";
  id: string;
  name: string;
  children: LibraryNode[];
  collapsed: boolean;
}

export interface LibraryModuleRef {
  type: "module";
  moduleId: ModuleId;
}

export type LibraryNode = LibraryFolder | LibraryModuleRef;

// === Store ===

interface LibraryStore {
  tree: LibraryNode[];
  locked: boolean;

  toggleLock: () => void;
  setTree: (tree: LibraryNode[]) => void;
  addFolder: (parentId: string | null, name: string) => void;
  renameFolder: (folderId: string, name: string) => void;
  deleteFolder: (folderId: string) => void;
  toggleCollapse: (folderId: string) => void;
  addModuleRef: (moduleId: ModuleId) => void;
  moveModuleToFolder: (moduleId: ModuleId, targetFolderId: string | null, insertIndex?: number) => void;
  syncModules: (moduleIds: Set<ModuleId>) => void;
}

// === Helpers ===

function collectModuleIds(nodes: LibraryNode[]): Set<ModuleId> {
  const ids = new Set<ModuleId>();
  for (const node of nodes) {
    if (node.type === "module") {
      ids.add(node.moduleId);
    } else {
      for (const id of collectModuleIds(node.children)) {
        ids.add(id);
      }
    }
  }
  return ids;
}

function removeModuleRef(
  nodes: LibraryNode[],
  moduleId: ModuleId,
): LibraryNode[] {
  return nodes
    .filter((n) => !(n.type === "module" && n.moduleId === moduleId))
    .map((n) =>
      n.type === "folder"
        ? { ...n, children: removeModuleRef(n.children, moduleId) }
        : n,
    );
}

function addModuleToFolder(
  nodes: LibraryNode[],
  moduleId: ModuleId,
  folderId: string,
): LibraryNode[] {
  return nodes.map((n) => {
    if (n.type !== "folder") return n;
    if (n.id === folderId) {
      return { ...n, children: [...n.children, { type: "module" as const, moduleId }] };
    }
    return { ...n, children: addModuleToFolder(n.children, moduleId, folderId) };
  });
}

function findModulePosition(
  nodes: LibraryNode[],
  moduleId: ModuleId,
  parentFolderId: string | null = null,
): { folderId: string | null; index: number } | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.type === "module" && node.moduleId === moduleId) {
      return { folderId: parentFolderId, index: i };
    }
    if (node.type === "folder") {
      const found = findModulePosition(node.children, moduleId, node.id);
      if (found) return found;
    }
  }
  return null;
}

function insertModuleAt(
  nodes: LibraryNode[],
  moduleId: ModuleId,
  folderId: string | null,
  index: number,
): LibraryNode[] {
  const ref: LibraryModuleRef = { type: "module", moduleId };
  if (folderId === null) {
    const clamped = Math.min(Math.max(0, index), nodes.length);
    const result = [...nodes];
    result.splice(clamped, 0, ref);
    return result;
  }
  return nodes.map((n) => {
    if (n.type !== "folder") return n;
    if (n.id === folderId) {
      const clamped = Math.min(Math.max(0, index), n.children.length);
      const children = [...n.children];
      children.splice(clamped, 0, ref);
      return { ...n, children };
    }
    return { ...n, children: insertModuleAt(n.children, moduleId, folderId, index) };
  });
}

function removeModuleRefs(
  nodes: LibraryNode[],
  idsToRemove: Set<ModuleId>,
): LibraryNode[] {
  return nodes
    .filter((n) => !(n.type === "module" && idsToRemove.has(n.moduleId)))
    .map((n) =>
      n.type === "folder"
        ? { ...n, children: removeModuleRefs(n.children, idsToRemove) }
        : n,
    );
}

function updateFolder(
  nodes: LibraryNode[],
  folderId: string,
  updater: (f: LibraryFolder) => LibraryFolder,
): LibraryNode[] {
  return nodes.map((n) => {
    if (n.type === "folder") {
      if (n.id === folderId) return updater(n);
      return { ...n, children: updateFolder(n.children, folderId, updater) };
    }
    return n;
  });
}

function deleteFolder(
  nodes: LibraryNode[],
  folderId: string,
): LibraryNode[] {
  const result: LibraryNode[] = [];
  for (const n of nodes) {
    if (n.type === "folder" && n.id === folderId) {
      // Move children to parent level
      result.push(...n.children);
    } else if (n.type === "folder") {
      result.push({ ...n, children: deleteFolder(n.children, folderId) });
    } else {
      result.push(n);
    }
  }
  return result;
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  tree: [],
  locked: false,

  toggleLock: () => set((state) => ({ locked: !state.locked })),

  setTree: (tree) => set({ tree }),

  addFolder: (parentId, name) => {
    const folder: LibraryFolder = {
      type: "folder",
      id: generateId(),
      name,
      children: [],
      collapsed: false,
    };

    if (!parentId) {
      set((state) => ({ tree: [...state.tree, folder] }));
      return;
    }

    set((state) => ({
      tree: updateFolder(state.tree, parentId, (f) => ({
        ...f,
        children: [...f.children, folder],
      })),
    }));
  },

  renameFolder: (folderId, name) => {
    set((state) => ({
      tree: updateFolder(state.tree, folderId, (f) => ({ ...f, name })),
    }));
  },

  deleteFolder: (folderId) => {
    set((state) => ({ tree: deleteFolder(state.tree, folderId) }));
  },

  toggleCollapse: (folderId) => {
    set((state) => ({
      tree: updateFolder(state.tree, folderId, (f) => ({
        ...f,
        collapsed: !f.collapsed,
      })),
    }));
  },

  addModuleRef: (moduleId) => {
    set((state) => ({
      tree: [...state.tree, { type: "module" as const, moduleId }],
    }));
  },

  moveModuleToFolder: (moduleId, targetFolderId, insertIndex?) => {
    if (get().locked) return;
    let tree = get().tree;

    if (insertIndex !== undefined) {
      // Positional insert — adjust index if moving within same container
      const pos = findModulePosition(tree, moduleId);
      let adjustedIndex = insertIndex;
      if (pos && pos.folderId === targetFolderId && pos.index < insertIndex) {
        adjustedIndex--;
      }
      tree = removeModuleRef(tree, moduleId);
      tree = insertModuleAt(tree, moduleId, targetFolderId, adjustedIndex);
    } else {
      // Append (original behavior)
      tree = removeModuleRef(tree, moduleId);
      if (targetFolderId) {
        tree = addModuleToFolder(tree, moduleId, targetFolderId);
      } else {
        tree = [...tree, { type: "module" as const, moduleId }];
      }
    }

    set({ tree });
  },

  syncModules: (moduleIds) => {
    const tree = get().tree;
    const existingIds = collectModuleIds(tree);

    // Remove refs to deleted modules
    const deletedIds = new Set<ModuleId>();
    for (const id of existingIds) {
      if (!moduleIds.has(id)) deletedIds.add(id);
    }

    let updated = deletedIds.size > 0 ? removeModuleRefs(tree, deletedIds) : tree;

    // Add refs for new modules
    for (const id of moduleIds) {
      if (!existingIds.has(id)) {
        updated = [...updated, { type: "module" as const, moduleId: id }];
      }
    }

    if (updated !== tree) {
      set({ tree: updated });
    }
  },
}));
