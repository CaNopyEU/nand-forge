import { describe, expect, it, vi, beforeEach } from "vitest";
import { useLibraryStore, type LibraryNode, type LibraryFolder, type LibraryModuleRef } from "../../src/store/library-store.ts";

// Mock generateId with a counter
let idCounter = 0;
vi.mock("../../src/utils/id.ts", () => ({
  generateId: () => `id-${++idCounter}`,
}));

function getTree(): LibraryNode[] {
  return useLibraryStore.getState().tree;
}

beforeEach(() => {
  idCounter = 0;
  useLibraryStore.setState({ tree: [], locked: false });
});

// === addFolder ===

describe("addFolder", () => {
  it("adds a folder to root when parentId is null", () => {
    useLibraryStore.getState().addFolder(null, "Gates");
    const tree = getTree();
    expect(tree).toHaveLength(1);
    const folder = tree[0]! as LibraryFolder;
    expect(folder.type).toBe("folder");
    expect(folder.name).toBe("Gates");
    expect(folder.id).toBe("id-1");
    expect(folder.collapsed).toBe(false);
    expect(folder.children).toEqual([]);
  });

  it("adds a nested folder inside an existing folder", () => {
    useLibraryStore.getState().addFolder(null, "Parent");
    const parentId = (getTree()[0]! as LibraryFolder).id;
    useLibraryStore.getState().addFolder(parentId, "Child");
    const parent = getTree()[0]! as LibraryFolder;
    expect(parent.children).toHaveLength(1);
    const child = parent.children[0]! as LibraryFolder;
    expect(child.name).toBe("Child");
  });

  it("creates folders with default properties", () => {
    useLibraryStore.getState().addFolder(null, "Test");
    const folder = getTree()[0]! as LibraryFolder;
    expect(folder.type).toBe("folder");
    expect(folder.collapsed).toBe(false);
    expect(folder.children).toEqual([]);
  });
});

// === renameFolder ===

describe("renameFolder", () => {
  it("renames a root-level folder", () => {
    useLibraryStore.getState().addFolder(null, "Old");
    const folderId = (getTree()[0]! as LibraryFolder).id;
    useLibraryStore.getState().renameFolder(folderId, "New");
    expect((getTree()[0]! as LibraryFolder).name).toBe("New");
  });

  it("renames a nested folder", () => {
    useLibraryStore.getState().addFolder(null, "Parent");
    const parentId = (getTree()[0]! as LibraryFolder).id;
    useLibraryStore.getState().addFolder(parentId, "Child");
    const childId = ((getTree()[0]! as LibraryFolder).children[0]! as LibraryFolder).id;
    useLibraryStore.getState().renameFolder(childId, "Renamed");
    expect(((getTree()[0]! as LibraryFolder).children[0]! as LibraryFolder).name).toBe("Renamed");
  });

  it("is a no-op for non-existent folder", () => {
    useLibraryStore.getState().addFolder(null, "Only");
    useLibraryStore.getState().renameFolder("nonexistent", "Fail");
    expect((getTree()[0]! as LibraryFolder).name).toBe("Only");
  });
});

// === deleteFolder ===

describe("deleteFolder", () => {
  it("promotes children to parent level", () => {
    useLibraryStore.getState().addFolder(null, "Parent");
    const parentId = (getTree()[0]! as LibraryFolder).id;
    useLibraryStore.getState().addModuleRef("mod-a");
    useLibraryStore.getState().moveModuleToFolder("mod-a", parentId);
    useLibraryStore.getState().deleteFolder(parentId);
    const tree = getTree();
    expect(tree).toHaveLength(1);
    expect((tree[0]! as LibraryModuleRef).moduleId).toBe("mod-a");
  });

  it("deletes a nested folder and promotes its children", () => {
    useLibraryStore.getState().addFolder(null, "Root");
    const rootId = (getTree()[0]! as LibraryFolder).id;
    useLibraryStore.getState().addFolder(rootId, "Nested");
    const nestedId = ((getTree()[0]! as LibraryFolder).children[0]! as LibraryFolder).id;
    useLibraryStore.getState().addModuleRef("mod-x");
    useLibraryStore.getState().moveModuleToFolder("mod-x", nestedId);
    useLibraryStore.getState().deleteFolder(nestedId);
    const rootFolder = getTree()[0]! as LibraryFolder;
    expect(rootFolder.children).toHaveLength(1);
    expect((rootFolder.children[0]! as LibraryModuleRef).moduleId).toBe("mod-x");
  });

  it("is a no-op for non-existent folder", () => {
    useLibraryStore.getState().addFolder(null, "Keep");
    useLibraryStore.getState().deleteFolder("nonexistent");
    expect(getTree()).toHaveLength(1);
  });
});

// === toggleCollapse ===

describe("toggleCollapse", () => {
  it("toggles collapsed from false to true", () => {
    useLibraryStore.getState().addFolder(null, "F");
    const folderId = (getTree()[0]! as LibraryFolder).id;
    expect((getTree()[0]! as LibraryFolder).collapsed).toBe(false);
    useLibraryStore.getState().toggleCollapse(folderId);
    expect((getTree()[0]! as LibraryFolder).collapsed).toBe(true);
  });

  it("toggles collapsed from true back to false", () => {
    useLibraryStore.getState().addFolder(null, "F");
    const folderId = (getTree()[0]! as LibraryFolder).id;
    useLibraryStore.getState().toggleCollapse(folderId);
    useLibraryStore.getState().toggleCollapse(folderId);
    expect((getTree()[0]! as LibraryFolder).collapsed).toBe(false);
  });
});

// === addModuleRef ===

describe("addModuleRef", () => {
  it("adds a module reference at root level", () => {
    useLibraryStore.getState().addModuleRef("mod-1");
    const tree = getTree();
    expect(tree).toHaveLength(1);
    expect(tree[0]!.type).toBe("module");
    expect((tree[0]! as LibraryModuleRef).moduleId).toBe("mod-1");
  });
});

// === moveModuleToFolder ===

describe("moveModuleToFolder", () => {
  it("moves module from root to folder", () => {
    useLibraryStore.getState().addModuleRef("mod-1");
    useLibraryStore.getState().addFolder(null, "Folder");
    const folderId = (getTree()[1]! as LibraryFolder).id;
    useLibraryStore.getState().moveModuleToFolder("mod-1", folderId);
    const tree = getTree();
    expect(tree).toHaveLength(1); // only folder remains at root
    const folder = tree[0]! as LibraryFolder;
    expect(folder.children).toHaveLength(1);
    expect((folder.children[0]! as LibraryModuleRef).moduleId).toBe("mod-1");
  });

  it("moves module from folder to root", () => {
    useLibraryStore.getState().addFolder(null, "Folder");
    const folderId = (getTree()[0]! as LibraryFolder).id;
    useLibraryStore.getState().addModuleRef("mod-1");
    useLibraryStore.getState().moveModuleToFolder("mod-1", folderId);
    // Now move back to root
    useLibraryStore.getState().moveModuleToFolder("mod-1", null);
    const tree = getTree();
    expect(tree).toHaveLength(2);
    expect((tree[0]! as LibraryFolder).children).toEqual([]);
    expect((tree[1]! as LibraryModuleRef).moduleId).toBe("mod-1");
  });

  it("moves module from one folder to another", () => {
    useLibraryStore.getState().addFolder(null, "A");
    useLibraryStore.getState().addFolder(null, "B");
    const folderAId = (getTree()[0]! as LibraryFolder).id;
    const folderBId = (getTree()[1]! as LibraryFolder).id;
    useLibraryStore.getState().addModuleRef("mod-1");
    useLibraryStore.getState().moveModuleToFolder("mod-1", folderAId);
    useLibraryStore.getState().moveModuleToFolder("mod-1", folderBId);
    expect((getTree()[0]! as LibraryFolder).children).toHaveLength(0);
    expect((getTree()[1]! as LibraryFolder).children).toHaveLength(1);
  });

  it("inserts at specific index", () => {
    useLibraryStore.getState().addModuleRef("mod-1");
    useLibraryStore.getState().addModuleRef("mod-2");
    useLibraryStore.getState().addModuleRef("mod-3");
    // Move mod-3 to index 0
    useLibraryStore.getState().moveModuleToFolder("mod-3", null, 0);
    const tree = getTree();
    expect(tree).toHaveLength(3);
    expect((tree[0]! as LibraryModuleRef).moduleId).toBe("mod-3");
    expect((tree[1]! as LibraryModuleRef).moduleId).toBe("mod-1");
    expect((tree[2]! as LibraryModuleRef).moduleId).toBe("mod-2");
  });

  it("adjusts index when moving within same container", () => {
    useLibraryStore.getState().addModuleRef("mod-1");
    useLibraryStore.getState().addModuleRef("mod-2");
    useLibraryStore.getState().addModuleRef("mod-3");
    // Move mod-1 (index 0) to index 2 — should adjust to 1 after removal
    useLibraryStore.getState().moveModuleToFolder("mod-1", null, 2);
    const tree = getTree();
    expect(tree).toHaveLength(3);
    expect((tree[0]! as LibraryModuleRef).moduleId).toBe("mod-2");
    expect((tree[1]! as LibraryModuleRef).moduleId).toBe("mod-1");
    expect((tree[2]! as LibraryModuleRef).moduleId).toBe("mod-3");
  });

  it("does nothing when store is locked", () => {
    useLibraryStore.getState().addModuleRef("mod-1");
    useLibraryStore.getState().addFolder(null, "Folder");
    useLibraryStore.getState().toggleLock();
    const folderId = (getTree()[1]! as LibraryFolder).id;
    useLibraryStore.getState().moveModuleToFolder("mod-1", folderId);
    // Module should still be at root
    expect(getTree()).toHaveLength(2);
    expect((getTree()[0]! as LibraryModuleRef).moduleId).toBe("mod-1");
  });
});

// === syncModules ===

describe("syncModules", () => {
  it("adds refs for new modules", () => {
    useLibraryStore.getState().syncModules(new Set(["mod-1", "mod-2"]));
    const tree = getTree();
    expect(tree).toHaveLength(2);
    const ids = tree.map((n) => (n as LibraryModuleRef).moduleId);
    expect(ids).toContain("mod-1");
    expect(ids).toContain("mod-2");
  });

  it("removes refs for stale modules", () => {
    useLibraryStore.getState().addModuleRef("mod-1");
    useLibraryStore.getState().addModuleRef("mod-2");
    useLibraryStore.getState().syncModules(new Set(["mod-1"]));
    const tree = getTree();
    expect(tree).toHaveLength(1);
    expect((tree[0]! as LibraryModuleRef).moduleId).toBe("mod-1");
  });

  it("handles mixed add and remove", () => {
    useLibraryStore.getState().addModuleRef("mod-1");
    useLibraryStore.getState().addModuleRef("mod-2");
    useLibraryStore.getState().syncModules(new Set(["mod-2", "mod-3"]));
    const tree = getTree();
    expect(tree).toHaveLength(2);
    const ids = tree.map((n) => (n as LibraryModuleRef).moduleId);
    expect(ids).toContain("mod-2");
    expect(ids).toContain("mod-3");
    expect(ids).not.toContain("mod-1");
  });

  it("is idempotent when modules match", () => {
    useLibraryStore.getState().addModuleRef("mod-1");
    const treeBefore = getTree();
    useLibraryStore.getState().syncModules(new Set(["mod-1"]));
    const treeAfter = getTree();
    expect(treeAfter).toEqual(treeBefore);
  });
});
