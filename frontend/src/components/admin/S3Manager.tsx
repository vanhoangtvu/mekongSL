"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  Image,
  Archive,
  Database,
  ChevronRight,
  ChevronDown,
  Upload,
  Plus,
  RefreshCw,
  Download,
  Trash2,
  Edit3,
  Copy,
  Link,
  Search,
  X,
  Home,
  Grid3X3,
  List,
  AlertTriangle,
  FileSpreadsheet,
  FileImage,
  FileJson,
  FileArchive,
  Globe,
  Clock,
  HardDrive,
  User,
  ArrowUpDown,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
  FolderPlus,
  FileType,
  MoreVertical,
} from "lucide-react";
import {
  listS3Folder,
  uploadS3File,
  deleteS3File,
  downloadS3File,
  createS3Folder,
  renameS3File,
  renameS3Folder,
  listGisLayers,
  registerLayerObject,
  type S3FileItem,
  type GisLayer,
} from "../../lib/admin-api";

// ─── Types ───────────────────────────────────────────────────────────────────

type TreeNode = {
  path: string;
  name: string;
  children: TreeNode[];
  loaded: boolean;
  expanded: boolean;
};

type SortField = "name" | "size" | "date";
type SortDir = "asc" | "desc";
type ViewMode = "table" | "grid";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("vi-VN");
}

function getParentPath(path: string) {
  const parts = path.replace(/\/$/, "").split("/");
  parts.pop();
  return parts.length > 0 ? parts.join("/") + "/" : "";
}

function getFolderName(path: string) {
  const parts = path.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || "";
}

function truncatePath(path: string, maxLen: number = 60): string {
  if (path.length <= maxLen) return path;
  const sep = '/';
  const parts = path.split(sep);
  if (parts.length <= 2) return path;
  const fileName = parts.pop() || '';
  const prefix = parts[0];
  const suffix = parts[parts.length - 1];
  const middle = '...';
  const remaining = maxLen - prefix.length - suffix.length - fileName.length - middle.length - 3;
  if (remaining < 10) {
    return prefix + sep + middle + sep + suffix + sep + fileName;
  }
  const dirs = parts.slice(1, -1);
  let total = prefix.length + suffix.length + fileName.length + middle.length + 3;
  const kept: string[] = [];
  for (const d of dirs) {
    if (total + d.length + 1 <= maxLen) {
      kept.push(d);
      total += d.length + 1;
    } else {
      break;
    }
  }
  const keptStr = kept.join(sep);
  if (!keptStr) {
    return prefix + sep + middle + sep + suffix + sep + fileName;
  }
  return prefix + sep + keptStr + sep + middle + sep + suffix + sep + fileName;
}

function getFileExtension(filename: string) {
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(i).toLowerCase() : "";
}

type FileCategory =
  | "geotiff"
  | "backup"
  | "spreadsheet"
  | "image"
  | "document"
  | "archive"
  | "data"
  | "other";

function getFileCategory(key: string): FileCategory {
  const ext = getFileExtension(key);
  if ([".tif", ".tiff", ".geotiff"].includes(ext)) return "geotiff";
  if ([".sql", ".sql.gz"].includes(ext)) return "backup";
  if ([".xlsx", ".xls", ".csv"].includes(ext)) return "spreadsheet";
  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(ext))
    return "image";
  if ([".pdf", ".doc", ".docx", ".txt"].includes(ext)) return "document";
  if ([".zip", ".tar", ".gz", ".rar", ".7z"].includes(ext)) return "archive";
  if ([".json", ".xml", ".yaml", ".yml"].includes(ext)) return "data";
  return "other";
}

const CATEGORY_META: Record<
  FileCategory,
  { label: string; color: string; bg: string }
> = {
  geotiff: {
    label: "GeoTIFF",
    color: "#16a34a",
    bg: "rgba(22,163,74,0.1)",
  },
  backup: { label: "Backup", color: "#2563eb", bg: "rgba(37,99,235,0.1)" },
  spreadsheet: {
    label: "Bảng tính",
    color: "#7c3aed",
    bg: "rgba(124,58,237,0.1)",
  },
  image: { label: "Hình ảnh", color: "#db2777", bg: "rgba(219,39,119,0.1)" },
  document: {
    label: "Tài liệu",
    color: "#0891b2",
    bg: "rgba(8,145,178,0.1)",
  },
  archive: { label: "Nén", color: "#ea580c", bg: "rgba(234,88,12,0.1)" },
  data: { label: "Dữ liệu", color: "#65a30d", bg: "rgba(101,163,13,0.1)" },
  other: { label: "Khác", color: "#64748b", bg: "rgba(100,116,139,0.1)" },
};

function getFileName(key: string) {
  return key.split("/").pop() || key;
}

// ─── FileIcon ────────────────────────────────────────────────────────────────

function FileIcon({
  category,
  size = 18,
}: {
  category: FileCategory;
  size?: number;
}) {
  const icons: Record<FileCategory, ReactNode> = {
    geotiff: <Globe size={size} />,
    backup: <Database size={size} />,
    spreadsheet: <FileSpreadsheet size={size} />,
    image: <FileImage size={size} />,
    document: <FileText size={size} />,
    archive: <FileArchive size={size} />,
    data: <FileJson size={size} />,
    other: <File size={size} />,
  };
  const meta = CATEGORY_META[category];
  return (
    <span
      style={{
        color: meta.color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {icons[category]}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function S3Manager() {
  // ── State ──────────────────────────────────────────────────────────────
  const [currentPath, setCurrentPath] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [files, setFiles] = useState<S3FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tree, setTree] = useState<TreeNode[]>([
    { path: "", name: "root", children: [], loaded: false, expanded: true },
  ]);

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showRename, setShowRename] = useState<{
    type: "file" | "folder";
    key: string;
  } | null>(null);
  const [showMapLayer, setShowMapLayer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const [showFileInfo, setShowFileInfo] = useState<S3FileItem | null>(null);

  // Upload
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadKey, setUploadKey] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Rename
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  // Folder
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Map to layer
  const [layers, setLayers] = useState<GisLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null);
  const [mapFileKey, setMapFileKey] = useState("");

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    kind: "success" | "error" | "info";
    id: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastId = useRef(0);

  // ── Helpers ───────────────────────────────────────────────────────────
  const showToast = useCallback(
    (text: string, kind: "success" | "error" | "info" = "info") => {
      const id = ++toastId.current;
      setToast({ text, kind, id });
      setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3500);
    },
    []
  );

  // ── Load folder ───────────────────────────────────────────────────────
  const loadFolder = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setSelectedFiles(new Set());
    try {
      const data = await listS3Folder(path);
      setFolders(data.folders);
      setFiles(data.files);
      setCurrentPath(data.prefix);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Không tải được thư mục";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // ── Tree ──────────────────────────────────────────────────────────────
  const loadTreeChildren = useCallback(async (nodePath: string) => {
    try {
      const data = await listS3Folder(nodePath);
      return { folders: data.folders, loaded: true };
    } catch {
      return { folders: [] as string[], loaded: true };
    }
  }, []);

  const toggleTreeNode = useCallback(
    (nodePath: string) => {
      const update = (nodes: TreeNode[]): TreeNode[] =>
        nodes.map((n) => {
          if (n.path === nodePath) {
            if (!n.loaded) {
              loadTreeChildren(nodePath).then(({ folders }) => {
                setTree((prev) => {
                  const upd = (ns: TreeNode[]): TreeNode[] =>
                    ns.map((nn) =>
                      nn.path === nodePath
                        ? {
                            ...nn,
                            loaded: true,
                            expanded: true,
                            children: folders.map((f) => ({
                              path: f,
                              name: getFolderName(f),
                              children: [],
                              loaded: false,
                              expanded: false,
                            })),
                          }
                        : { ...nn, children: upd(nn.children) }
                    );
                  return upd(prev);
                });
              });
              return { ...n, loaded: false, expanded: true, children: [] };
            }
            return { ...n, expanded: !n.expanded };
          }
          return { ...n, children: update(n.children) };
        });
      setTree((prev) => update(prev));
    },
    [loadTreeChildren]
  );

  const expandTreeNode = useCallback(
    (nodePath: string) => {
      setTree((prev) => {
        const update = (nodes: TreeNode[]): TreeNode[] =>
          nodes.map((n) => {
            if (n.path === nodePath) {
              if (!n.loaded) {
                loadTreeChildren(nodePath).then(({ folders }) => {
                  setTree((prev2) => {
                    const upd2 = (ns: TreeNode[]): TreeNode[] =>
                      ns.map((nn) =>
                        nn.path === nodePath
                          ? {
                              ...nn,
                              loaded: true,
                              expanded: true,
                              children: folders.map((f) => ({
                                path: f,
                                name: getFolderName(f),
                                children: [],
                                loaded: false,
                                expanded: false,
                              })),
                            }
                          : { ...nn, children: upd2(nn.children) }
                      );
                    return upd2(prev2);
                  });
                });
                return { ...n, loaded: false, expanded: true, children: [] };
              }
              return n.expanded ? n : { ...n, expanded: true };
            }
            return { ...n, children: update(n.children) };
          });
        return update(prev);
      });
    },
    [loadTreeChildren]
  );

  const navigateTo = useCallback(
    (path: string) => {
      loadFolder(path);
      if (!path) { expandTreeNode(""); return; }
      const parts = path.replace(/\/$/, "").split("/");
      let cur = "";
      for (const part of parts) {
        cur += part + "/";
        expandTreeNode(cur);
      }
    },
    [loadFolder, expandTreeNode]
  );

  const navigateUp = () => navigateTo(getParentPath(currentPath));

  // ── Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadFolder("");
    loadTreeChildren("").then(({ folders }) => {
      setTree([
        {
          path: "",
          name: "root",
          children: folders.map((f) => ({
            path: f,
            name: getFolderName(f),
            children: [],
            loaded: false,
            expanded: false,
          })),
          loaded: true,
          expanded: true,
        },
      ]);
    });
  }, [loadFolder, loadTreeChildren]);

  // ── Breadcrumbs ──────────────────────────────────────────────────────
  const breadcrumbs = useMemo(() => {
    if (!currentPath) return [{ label: "root", path: "" }];
    const parts = currentPath.replace(/\/$/, "").split("/");
    const crumbs = [{ label: "root", path: "" }];
    let acc = "";
    for (const part of parts) {
      acc += part + "/";
      crumbs.push({ label: part, path: acc });
    }
    return crumbs;
  }, [currentPath]);

  // ── Filter & sort ────────────────────────────────────────────────────
  const filteredFiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = q
      ? files.filter((f) => getFileName(f.key).toLowerCase().includes(q))
      : files;

    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortField) {
        case "name":
          return dir * (getFileName(a.key).localeCompare(getFileName(b.key)));
        case "size":
          return dir * ((a.size || 0) - (b.size || 0));
        case "date":
          return dir * ((a.lastModified || "").localeCompare(b.lastModified || ""));
        default:
          return 0;
      }
    });
    return list;
  }, [files, searchQuery, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="s3-sort-off" />;
    return sortDir === "asc" ? (
      <ChevronUp size={12} />
    ) : (
      <ChevronDownIcon size={12} />
    );
  };

  // ── Upload ────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of uploadFiles) {
        const key = uploadKey.trim()
          ? `${uploadKey.trim()}/${file.name}`
          : currentPath + file.name;
        await uploadS3File(file, key);
      }
      showToast(
        `Đã upload ${uploadFiles.length} file thành công`,
        "success"
      );
      setUploadFiles([]);
      setUploadKey("");
      setShowUpload(false);
      await loadFolder(currentPath);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Upload thất bại",
        "error"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) {
      setUploadFiles((prev) => [...prev, ...dropped]);
    }
  };

  // ── Create folder ────────────────────────────────────────────────────
  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    setCreatingFolder(true);
    try {
      const path = currentPath + folderName.trim().replace(/\/$/, "") + "/";
      await createS3Folder(path);
      showToast("Đã tạo thư mục", "success");
      setFolderName("");
      setShowNewFolder(false);
      await loadFolder(currentPath);
      const { folders } = await loadTreeChildren(getParentPath(path));
      setTree((prev) => {
        const upd = (ns: TreeNode[]): TreeNode[] =>
          ns.map((n) =>
            n.path === getParentPath(path)
              ? {
                  ...n,
                  loaded: true,
                  children: folders.map((f) => ({
                    path: f,
                    name: getFolderName(f),
                    children: [],
                    loaded: false,
                    expanded: false,
                  })),
                }
              : { ...n, children: upd(n.children) }
          );
        return upd(prev);
      });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Tạo thư mục thất bại",
        "error"
      );
    } finally {
      setCreatingFolder(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDelete = async (key: string) => {
    setBusyAction(`delete-${key}`);
    try {
      await deleteS3File(key);
      showToast("Đã xóa", "success");
      setShowDeleteConfirm(null);
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      await loadFolder(currentPath);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Xóa thất bại",
        "error"
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedFiles.size === 0) return;
    setBusyAction("batch-delete");
    try {
      for (const key of selectedFiles) {
        await deleteS3File(key);
      }
      showToast(`Đã xóa ${selectedFiles.size} file`, "success");
      setSelectedFiles(new Set());
      await loadFolder(currentPath);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Xóa thất bại",
        "error"
      );
    } finally {
      setBusyAction(null);
    }
  };

  // ── Rename ────────────────────────────────────────────────────────────
  const handleRename = async () => {
    if (!showRename || !renameValue.trim()) return;
    setRenaming(true);
    try {
      if (showRename.type === "file") {
        await renameS3File(
          showRename.key,
          getParentPath(showRename.key) + renameValue.trim()
        );
      } else {
        const newPrefix =
          getParentPath(showRename.key) +
          renameValue.trim().replace(/\/$/, "") +
          "/";
        await renameS3Folder(showRename.key, newPrefix);
        const { folders } = await loadTreeChildren("");
        setTree([
          {
            path: "",
            name: "root",
            children: folders.map((f) => ({
              path: f,
              name: getFolderName(f),
              children: [],
              loaded: false,
              expanded: false,
            })),
            loaded: true,
            expanded: true,
          },
        ]);
      }
      showToast("Đổi tên thành công", "success");
      setShowRename(null);
      setRenameValue("");
      await loadFolder(currentPath);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Đổi tên thất bại",
        "error"
      );
    } finally {
      setRenaming(false);
    }
  };

  // ── Map to layer ──────────────────────────────────────────────────────
  const handleMapToLayer = async (fileKey: string) => {
    setMapFileKey(fileKey);
    try {
      const data = await listGisLayers();
      setLayers(data);
      setSelectedLayerId(null);
      setShowMapLayer(true);
    } catch {
      showToast("Không tải được danh sách layer", "error");
    }
  };

  const handleConfirmMapLayer = async () => {
    if (!selectedLayerId || !mapFileKey) return;
    setBusyAction(`map-${mapFileKey}`);
    try {
      await registerLayerObject(selectedLayerId, mapFileKey);
      showToast("Ánh xạ vào layer thành công", "success");
      setShowMapLayer(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Ánh xạ thất bại",
        "error"
      );
    } finally {
      setBusyAction(null);
    }
  };

  // ── Selection ─────────────────────────────────────────────────────────
  const toggleFileSelection = (key: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === "/" || (e.key === "f" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Delete" && selectedFiles.size > 0) {
        const first = selectedFiles.values().next().value;
        if (first) setShowDeleteConfirm(first);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedFiles]);

  // ── Render tree ──────────────────────────────────────────────────────
  const renderTreeNode = (node: TreeNode, depth = 0): ReactNode => {
    const isCurrent = currentPath === node.path;
    const hasChildren = node.children.length > 0 || !node.loaded;

    return (
      <div key={node.path}>
        <div
          className={`s3-ti ${isCurrent ? "active" : ""}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => navigateTo(node.path === "" ? "" : node.path)}
          onContextMenu={(e) => {
            e.preventDefault();
            if (node.path) {
              setShowRename({ type: "folder", key: node.path });
              setRenameValue(node.name);
            }
          }}
        >
          <span
            className="s3-ti-toggle"
            onClick={(e) => {
              e.stopPropagation();
              node.path && toggleTreeNode(node.path);
            }}
          >
            {hasChildren ? (
              node.expanded ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )
            ) : (
              <span style={{ width: 12 }} />
            )}
          </span>
          {node.expanded && node.loaded ? (
            <FolderOpen size={15} className="s3-ti-folder-open" />
          ) : (
            <Folder size={15} className="s3-ti-folder" />
          )}
          <span className="s3-ti-name">{node.name}</span>
        </div>
        {node.expanded &&
          node.loaded &&
          node.children.map((c) => renderTreeNode(c, depth + 1))}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────

  const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);

  return (
    <div className="s3">
      {/* Toast */}
      {toast && (
        <div className={`s3-toast kind-${toast.kind}`}>
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      {/* ═══ Toolbar ═══ */}
      <div className="s3-toolbar">
        <div className="s3-toolbar-left">
          {/* Breadcrumb */}
          <nav className="s3-breadcrumb">
            {breadcrumbs.map((cr, i) => (
              <span key={cr.path} className="s3-bc-item">
                {i > 0 && <ChevronRight size={10} className="s3-bc-sep" />}
                {i === 0 ? (
                  <button className="s3-bc-btn" onClick={() => navigateTo("")}
                    title="Root"><Home size={14} /></button>
                ) : (
                  <button
                    className={`s3-bc-btn ${i === breadcrumbs.length - 1 ? "current" : ""}`}
                    onClick={() => navigateTo(cr.path)}
                  >
                    {cr.label}
                  </button>
                )}
              </span>
            ))}
          </nav>
        </div>

        <div className="s3-toolbar-right">
          {/* Search */}
          <div className="s3-search">
            <Search size={14} className="s3-search-icon" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm file…"
              className="s3-search-input"
            />
            {searchQuery && (
              <button className="s3-search-clear" onClick={() => setSearchQuery("")}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* View toggle */}
          <button
            className="s3-btn s3-btn-icon"
            onClick={() => setViewMode(viewMode === "table" ? "grid" : "table")}
            title={viewMode === "table" ? "Xem dạng lưới" : "Xem dạng bảng"}
          >
            {viewMode === "table" ? <Grid3X3 size={16} /> : <List size={16} />}
          </button>

          {/* Nav up */}
          <button className="s3-btn s3-btn-icon" disabled={!currentPath}
            onClick={navigateUp} title="Lên trên">
            <ChevronUp size={16} />
          </button>

          {/* Refresh */}
          <button className="s3-btn s3-btn-icon" onClick={() => loadFolder(currentPath)}
            disabled={loading} title="Làm mới">
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>

          <div className="s3-divider" />

          {/* New folder */}
          <button className="s3-btn" onClick={() => { setShowNewFolder(true); setFolderName(""); }}>
            <FolderPlus size={16} />
            <span className="s3-btn-label">Thư mục</span>
          </button>

          {/* Upload */}
          <button className="s3-btn s3-btn-primary" onClick={() => { setShowUpload(true); setUploadFiles([]); setUploadKey(""); }}>
            <Upload size={16} />
            <span className="s3-btn-label">Upload</span>
          </button>

          {/* Batch delete */}
          {selectedFiles.size > 0 && (
            <button className="s3-btn s3-btn-danger" onClick={handleBatchDelete} disabled={busyAction === "batch-delete"}>
              <Trash2 size={16} />
              <span className="s3-btn-label">Xóa {selectedFiles.size}</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══ Main ═══ */}
      <div className="s3-body">
        {/* ─── Tree panel ─── */}
        <aside className="s3-sidebar">
          <div className="s3-sidebar-header">Thư mục</div>
          <div className="s3-sidebar-tree">
            {tree.map((n) => renderTreeNode(n))}
          </div>
        </aside>

        {/* ─── Content ─── */}
        <main className="s3-content">
          {loading ? (
            <div className="s3-empty">
              <RefreshCw size={28} className="spin" />
              <p>Đang tải…</p>
            </div>
          ) : error ? (
            <div className="s3-empty">
              <AlertTriangle size={28} className="s3-empty-error" />
              <p>{error}</p>
              <button className="s3-btn" onClick={() => loadFolder(currentPath)}>
                Thử lại
              </button>
            </div>
          ) : folders.length === 0 && filteredFiles.length === 0 ? (
            <div className="s3-empty">
              <Folder size={48} className="s3-empty-icon" />
              <p>Thư mục trống</p>
              <span className="s3-empty-hint">
                {searchQuery
                  ? "Không tìm thấy file phù hợp"
                  : "Kéo thả file hoặc dùng nút Upload để thêm dữ liệu"}
              </span>
              {!searchQuery && (
                <div className="s3-empty-actions">
                  <button className="s3-btn s3-btn-primary"
                    onClick={() => { setShowUpload(true); setUploadFiles([]); }}>
                    <Upload size={16} /> Upload file
                  </button>
                  <button className="s3-btn"
                    onClick={() => { setShowNewFolder(true); setFolderName(""); }}>
                    <FolderPlus size={16} /> Tạo thư mục
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Status bar */}
              <div className="s3-status">
                <span className="s3-status-count">
                  {folders.length} thư mục, {filteredFiles.length} file
                </span>
                {totalSize > 0 && (
                  <span className="s3-status-size">
                    <HardDrive size={12} /> {formatSize(totalSize)}
                  </span>
                )}
                {searchQuery && (
                  <span className="s3-status-search">
                    Tìm kiếm: "{searchQuery}"
                  </span>
                )}
              </div>

              {/* Folders */}
              {folders.length > 0 && (
                <div className="s3-folders">
                  <div className="s3-folders-grid">
                    {folders.map((fp) => {
                      const name = getFolderName(fp);
                      return (
                        <div
                          key={fp}
                          className="s3-fc"
                          onClick={() => navigateTo(fp)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setShowRename({ type: "folder", key: fp });
                            setRenameValue(name);
                          }}
                        >
                          <Folder size={36} className="s3-fc-icon" />
                          <span className="s3-fc-name">{name}</span>
                          <div className="s3-fc-actions">
                            <button className="s3-act"
                              onClick={(e) => { e.stopPropagation(); navigateTo(fp); }}
                              title="Mở"><Search size={13} /></button>
                            <button className="s3-act"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowRename({ type: "folder", key: fp });
                                setRenameValue(name);
                              }}
                              title="Đổi tên"><Edit3 size={13} /></button>
                            <button className="s3-act s3-act-danger"
                              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(fp); }}
                              title="Xóa"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Files */}
              {filteredFiles.length > 0 && viewMode === "table" && (
                <div className="s3-table-wrap">
                  <table className="s3-table">
                    <thead>
                      <tr>
                        <th className="s3-th-cb">
                          <input
                            type="checkbox"
                            checked={
                              filteredFiles.length > 0 &&
                              filteredFiles.every((f) =>
                                selectedFiles.has(f.key)
                              )
                            }
                            onChange={() => {
                              if (
                                filteredFiles.every((f) =>
                                  selectedFiles.has(f.key)
                                )
                              ) {
                                setSelectedFiles(new Set());
                              } else {
                                setSelectedFiles(
                                  new Set(filteredFiles.map((f) => f.key))
                                );
                              }
                            }}
                          />
                        </th>
                        <th className="s3-th-sort" onClick={() => toggleSort("name")}>
                          Tên file <SortIcon field="name" />
                        </th>
                        <th className="s3-th-sort s3-th-type" onClick={() => toggleSort("name")}>
                          Loại
                        </th>
                        <th className="s3-th-sort s3-th-size" onClick={() => toggleSort("size")}>
                          Kích thước <SortIcon field="size" />
                        </th>
                        <th className="s3-th-sort s3-th-date" onClick={() => toggleSort("date")}>
                          Cập nhật <SortIcon field="date" />
                        </th>
                        <th className="s3-th-actions"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFiles.map((file) => {
                        const fileName = getFileName(file.key);
                        const cat = getFileCategory(file.key);
                        const meta = CATEGORY_META[cat];
                        const sel = selectedFiles.has(file.key);
                        return (
                          <tr
                            key={file.key}
                            className={`s3-tr ${sel ? "sel" : ""}`}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setShowFileInfo(file);
                            }}
                          >
                            <td className="s3-td-cb">
                              <input
                                type="checkbox"
                                checked={sel}
                                onChange={() => toggleFileSelection(file.key)}
                              />
                            </td>
                            <td
                              className="s3-td-name"
                              onClick={() => toggleFileSelection(file.key)}
                            >
                              <div className="s3-file">
                                <FileIcon category={cat} size={18} />
                                <span className="s3-file-name">{fileName}</span>
                              </div>
                            </td>
                            <td onClick={() => toggleFileSelection(file.key)}>
                              <span
                                className="s3-badge"
                                style={{
                                  background: meta.bg,
                                  color: meta.color,
                                }}
                              >
                                {meta.label}
                              </span>
                            </td>
                            <td
                              className="s3-td-num"
                              onClick={() => toggleFileSelection(file.key)}
                            >
                              {formatSize(file.size || 0)}
                            </td>
                            <td
                              className="s3-td-num"
                              onClick={() => toggleFileSelection(file.key)}
                            >
                              <span className="s3-date">
                                <Clock size={11} />
                                {formatDate(
                                  file.lastModified || file.modifiedAt
                                )}
                              </span>
                            </td>
                            <td className="s3-td-actions">
                              <FileActions
                                file={file}
                                onDownload={() => downloadS3File(file.key)}
                                onRename={() => {
                                  setShowRename({ type: "file", key: file.key });
                                  setRenameValue(fileName);
                                }}
                                onMap={() => handleMapToLayer(file.key)}
                                onCopyPath={() => {
                                  navigator.clipboard.writeText(file.key);
                                  showToast("Đã copy path", "info");
                                }}
                                onDelete={() => setShowDeleteConfirm(file.key)}
                                onInfo={() => setShowFileInfo(file)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Grid view */}
              {filteredFiles.length > 0 && viewMode === "grid" && (
                <div className="s3-grid">
                  {filteredFiles.map((file) => {
                    const fileName = getFileName(file.key);
                    const cat = getFileCategory(file.key);
                    const meta = CATEGORY_META[cat];
                    const sel = selectedFiles.has(file.key);
                    return (
                      <div
                        key={file.key}
                        className={`s3-gc ${sel ? "sel" : ""}`}
                        onClick={() => toggleFileSelection(file.key)}
                        onDoubleClick={() => downloadS3File(file.key)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setShowFileInfo(file);
                        }}
                      >
                        <div className="s3-gc-icon" style={{ background: meta.bg, color: meta.color }}>
                          <FileIcon category={cat} size={24} />
                        </div>
                        <span className="s3-gc-name">{fileName}</span>
                        <span className="s3-gc-size">{formatSize(file.size || 0)}</span>
                        <div className="s3-gc-bar" style={{ width: `${Math.min(100, ((file.size || 0) / (totalSize || 1)) * 100)}%` }} />
                        <div className="s3-gc-actions">
                          <button className="s3-act" onClick={() => downloadS3File(file.key)} title="Tải"><Download size={13} /></button>
                          <button className="s3-act" onClick={() => { setShowRename({ type: "file", key: file.key }); setRenameValue(fileName); }} title="Đổi tên"><Edit3 size={13} /></button>
                          <button className="s3-act s3-act-danger" onClick={() => setShowDeleteConfirm(file.key)} title="Xóa"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ═══ File info sidebar ═══ */}
      {showFileInfo && (
        <div className="s3-overlay" onClick={() => setShowFileInfo(null)}>
          <div className="s3-panel-info" onClick={(e) => e.stopPropagation()}>
            <div className="s3-pi-header">
              <h3>Thông tin file</h3>
              <button className="s3-btn-icon-sm" onClick={() => setShowFileInfo(null)}><X size={16} /></button>
            </div>
            <div className="s3-pi-body">
              <div className="s3-pi-icon">
                <FileIcon category={getFileCategory(showFileInfo.key)} size={40} />
              </div>
              <div className="s3-pi-row">
                <span className="s3-pi-label">Tên</span>
                <span className="s3-pi-value">{getFileName(showFileInfo.key)}</span>
              </div>
              <div className="s3-pi-row">
                <span className="s3-pi-label">Đường dẫn</span>
                <span className="s3-pi-value mono" title={showFileInfo.key} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>{truncatePath(showFileInfo.key, 50)}</span>
              </div>
              <div className="s3-pi-row">
                <span className="s3-pi-label">Kích thước</span>
                <span className="s3-pi-value">{formatSize(showFileInfo.size || 0)}</span>
              </div>
              <div className="s3-pi-row">
                <span className="s3-pi-label">Cập nhật</span>
                <span className="s3-pi-value">{formatDate(showFileInfo.lastModified || showFileInfo.modifiedAt)}</span>
              </div>
              <div className="s3-pi-row">
                <span className="s3-pi-label">Loại</span>
                <span className="s3-pi-value">{CATEGORY_META[getFileCategory(showFileInfo.key)].label}</span>
              </div>
            </div>
            <div className="s3-pi-footer">
              <button className="s3-btn" onClick={() => downloadS3File(showFileInfo.key)}>
                <Download size={14} /> Tải xuống
              </button>
              <button className="s3-btn" onClick={() => { navigator.clipboard.writeText(showFileInfo.key); showToast("Đã copy path", "info"); }}>
                <Copy size={14} /> Copy path
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Upload modal ═══ */}
      {showUpload && (
        <div className="s3-overlay" onClick={() => setShowUpload(false)}>
          <div className="s3-modal" onClick={(e) => e.stopPropagation()}>
            <div className="s3-modal-header">
              <h3><Upload size={18} /> Upload file</h3>
              <button className="s3-btn-icon-sm" onClick={() => setShowUpload(false)}><X size={18} /></button>
            </div>
            <div className="s3-modal-body">
              {/* Drop zone */}
              <div
                className={`s3-dropzone ${dragOver ? "dragover" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} className="s3-dropzone-icon" />
                <p className="s3-dropzone-text">
                  {dragOver
                    ? "Thả file vào đây"
                    : "Kéo thả file vào đây hoặc click để chọn"}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) =>
                    setUploadFiles((prev) => [
                      ...prev,
                      ...Array.from(e.target.files || []),
                    ])
                  }
                />
              </div>

              {uploadFiles.length > 0 && (
                <div className="s3-upload-list">
                  {uploadFiles.map((f, i) => (
                    <div key={i} className="s3-upload-item">
                      <File size={14} />
                      <span className="s3-upload-name">{f.name}</span>
                      <span className="s3-upload-size">{formatSize(f.size)}</span>
                      <button
                        className="s3-btn-icon-sm"
                        onClick={() =>
                          setUploadFiles((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="s3-form-row">
                <label className="s3-label">
                  Đường dẫn đích
                  <input
                    value={uploadKey}
                    onChange={(e) => setUploadKey(e.target.value)}
                    placeholder={currentPath + "thu-muc/"}
                    className="s3-input"
                  />
                </label>
              </div>
            </div>
            <div className="s3-modal-footer">
              <button className="s3-btn" onClick={() => setShowUpload(false)}>Hủy</button>
              <button
                className="s3-btn s3-btn-primary"
                onClick={handleUpload}
                disabled={uploadFiles.length === 0 || uploading}
              >
                {uploading ? (
                  <><RefreshCw size={16} className="spin" /> Đang upload…</>
                ) : (
                  <><Upload size={16} /> Upload {uploadFiles.length > 0 ? `(${uploadFiles.length} file)` : ""}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ New folder modal ═══ */}
      {showNewFolder && (
        <div className="s3-overlay" onClick={() => setShowNewFolder(false)}>
          <div className="s3-modal s3-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="s3-modal-header">
              <h3><FolderPlus size={18} /> Tạo thư mục</h3>
              <button className="s3-btn-icon-sm" onClick={() => setShowNewFolder(false)}><X size={18} /></button>
            </div>
            <div className="s3-modal-body">
              <div className="s3-form-row">
                <label className="s3-label">
                  Vị trí
                  <div className="s3-path-preview">{currentPath || "gốc"}</div>
                </label>
              </div>
              <div className="s3-form-row">
                <label className="s3-label">
                  Tên thư mục
                  <input
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="ten-thu-muc"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                    className="s3-input"
                  />
                </label>
              </div>
            </div>
            <div className="s3-modal-footer">
              <button className="s3-btn" onClick={() => setShowNewFolder(false)}>Hủy</button>
              <button className="s3-btn s3-btn-primary" onClick={handleCreateFolder}
                disabled={!folderName.trim() || creatingFolder}>
                {creatingFolder ? "Đang tạo…" : "Tạo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Rename modal ═══ */}
      {showRename && (
        <div className="s3-overlay" onClick={() => setShowRename(null)}>
          <div className="s3-modal s3-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="s3-modal-header">
              <h3><Edit3 size={18} /> Đổi tên {showRename.type === "folder" ? "thư mục" : "file"}</h3>
              <button className="s3-btn-icon-sm" onClick={() => setShowRename(null)}><X size={18} /></button>
            </div>
            <div className="s3-modal-body">
              <div className="s3-form-row">
                <label className="s3-label">
                  Đường dẫn hiện tại
                  <div className="s3-path-preview mono" title={showRename.key}>{truncatePath(showRename.key, 70)}</div>
                </label>
              </div>
              <div className="s3-form-row">
                <label className="s3-label">
                  Tên mới
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleRename()}
                    className="s3-input"
                  />
                </label>
              </div>
            </div>
            <div className="s3-modal-footer">
              <button className="s3-btn" onClick={() => setShowRename(null)}>Hủy</button>
              <button className="s3-btn s3-btn-primary" onClick={handleRename}
                disabled={!renameValue.trim() || renaming}>
                {renaming ? "Đang đổi…" : "Đổi tên"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Map to layer modal ═══ */}
      {showMapLayer && (
        <div className="s3-overlay" onClick={() => setShowMapLayer(false)}>
          <div className="s3-modal" onClick={(e) => e.stopPropagation()}>
            <div className="s3-modal-header">
              <h3><Link size={18} /> Ánh xạ vào GIS Layer</h3>
              <button className="s3-btn-icon-sm" onClick={() => setShowMapLayer(false)}><X size={18} /></button>
            </div>
            <div className="s3-modal-body">
              <div className="s3-form-row">
                <label className="s3-label">File</label>
                <div className="s3-path-preview mono">{mapFileKey}</div>
              </div>
              <div className="s3-form-row">
                <label className="s3-label">
                  Chọn Layer
                  <select
                    className="s3-input"
                    value={selectedLayerId ?? ""}
                    onChange={(e) => setSelectedLayerId(Number(e.target.value) || null)}
                  >
                    <option value="">— Chọn Layer —</option>
                    {layers.map((l) => (
                      <option key={l.id} value={l.id}>{l.id} — {l.layerName} ({l.layerType})</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="s3-modal-footer">
              <button className="s3-btn" onClick={() => setShowMapLayer(false)}>Hủy</button>
              <button className="s3-btn s3-btn-primary" onClick={handleConfirmMapLayer} disabled={!selectedLayerId}>
                <Link size={14} /> Ánh xạ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete confirm ═══ */}
      {showDeleteConfirm && (
        <div className="s3-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="s3-modal s3-modal-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="s3-modal-icon-warn">
              <AlertTriangle size={32} />
            </div>
            <h3>Xác nhận xóa</h3>
            <p className="s3-confirm-text">
              Bạn có chắc chắn muốn xóa <strong>{getFileName(showDeleteConfirm)}</strong>?
              <br />
              Hành động này không thể hoàn tác.
            </p>
            <div className="s3-confirm-path mono" title={showDeleteConfirm}>{truncatePath(showDeleteConfirm, 70)}</div>
            <div className="s3-modal-footer">
              <button className="s3-btn" onClick={() => setShowDeleteConfirm(null)}>Hủy</button>
              <button
                className="s3-btn s3-btn-danger"
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={busyAction === `delete-${showDeleteConfirm}`}
              >
                {busyAction === `delete-${showDeleteConfirm}` ? "Đang xóa…" : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Styles ═══ */}
      <style jsx>{`
/* ─── Base ─── */
.s3 {
  display: flex; flex-direction: column; height: 100%;
  min-height: 520px; position: relative; font-size: 0.88rem;
  color: var(--text); background: var(--background);
  --s3-radius: 10px;
  --s3-radius-lg: 14px;
}

/* ─── Toast ─── */
.s3-toast {
  position: fixed; top: 16px; right: 16px; z-index: 99999;
  display: flex; align-items: center; gap: 10px;
  padding: 12px 18px; border-radius: 12px;
  background: var(--surface); border: 1px solid var(--border);
  box-shadow: 0 6px 20px rgba(0,0,0,.18);
  font-size: .88rem; animation: slideIn .2s ease;
  backdrop-filter: blur(8px);
}
.s3-toast.kind-success { border-color: #22c55e44; color: #16a34a; }
.s3-toast.kind-error { border-color: #ef444444; color: #dc2626; }
.s3-toast.kind-info { border-color: #3b82f644; color: #2563eb; }
.s3-toast button { background: none; border: none; color: inherit; cursor: pointer; padding: 2px; opacity: .6; }
.s3-toast button:hover { opacity: 1; }
@keyframes slideIn { from { transform: translateX(100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }

/* ─── Toolbar ─── */
.s3-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--border);
  background: var(--surface); flex-wrap: wrap;
}
.s3-toolbar-left, .s3-toolbar-right { display: flex; align-items: center; gap: 6px; }
.s3-toolbar-right { flex-wrap: wrap; }

.s3-breadcrumb { display: flex; align-items: center; gap: 1px; }
.s3-bc-item { display: flex; align-items: center; gap: 1px; }
.s3-bc-sep { color: var(--text-muted); flex-shrink: 0; }
.s3-bc-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px; border: none; border-radius: 6px;
  background: transparent; color: var(--text); cursor: pointer;
  font-size: .84rem; white-space: nowrap; transition: 80ms;
}
.s3-bc-btn:hover { background: var(--surface-strong); }
.s3-bc-btn.current { font-weight: 600; color: var(--accent); }

/* Search */
.s3-search {
  display: flex; align-items: center; gap: 6px;
  padding: 0 10px; border: 1px solid var(--border);
  border-radius: 8px; background: var(--background-soft);
  transition: 140ms; width: 180px;
}
.s3-search:focus-within { border-color: var(--accent); width: 240px; }
.s3-search-icon { color: var(--text-muted); flex-shrink: 0; }
.s3-search-input {
  flex: 1; border: none; background: transparent;
  padding: 7px 0; color: var(--text); font-size: .84rem; outline: none;
}
.s3-search-clear { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; }

/* Buttons */
.s3-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border: 1px solid var(--border);
  border-radius: 8px; background: var(--surface);
  color: var(--text); cursor: pointer; font-size: .84rem;
  white-space: nowrap; transition: 100ms;
}
.s3-btn:hover { background: var(--surface-strong); border-color: var(--accent); }
.s3-btn:disabled { opacity: .45; cursor: not-allowed; }
.s3-btn-icon { padding: 7px; }
.s3-btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.s3-btn-primary:hover { background: var(--accent-hover); }
.s3-btn-danger { background: rgba(220,53,69,.1); color: #dc2626; border-color: #dc262644; }
.s3-btn-danger:hover { background: rgba(220,53,69,.18); }
.s3-divider { width: 1px; height: 22px; background: var(--border); margin: 0 2px; }

/* ─── Layout ─── */
.s3-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }

/* Sidebar */
.s3-sidebar {
  width: 220px; min-width: 180px; border-right: 1px solid var(--border);
  background: var(--surface); display: flex; flex-direction: column;
  overflow: hidden;
}
.s3-sidebar-header {
  padding: 10px 14px; font-size: .75rem; text-transform: uppercase;
  letter-spacing: .06em; color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
.s3-sidebar-tree { flex: 1; overflow-y: auto; padding: 4px 0; }

/* Tree items */
.s3-ti {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 10px; cursor: pointer; border-radius: 6px;
  margin: 1px 6px; user-select: none; transition: 60ms;
}
.s3-ti:hover { background: var(--surface-strong); }
.s3-ti.active { background: rgba(59,130,246,.1); color: var(--accent); font-weight: 500; }
.s3-ti-toggle {
  display: flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; flex-shrink: 0;
}
.s3-ti-folder { color: #f59e0b; flex-shrink: 0; }
.s3-ti-folder-open { color: #f59e0b; flex-shrink: 0; }
.s3-ti-name { font-size: .84rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ─── Content ─── */
.s3-content { flex: 1; overflow-y: auto; padding: 14px; background: var(--background); }

/* Empty state */
.s3-empty {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 10px; padding: 80px 20px;
  color: var(--text-muted); text-align: center;
}
.s3-empty-icon { opacity: .25; }
.s3-empty-error { color: #ef4444; }
.s3-empty-hint { font-size: .85rem; }
.s3-empty-actions { display: flex; gap: 8px; margin-top: 8px; }

/* Status bar */
.s3-status {
  display: flex; align-items: center; gap: 14px;
  padding: 6px 4px 10px; font-size: .8rem; color: var(--text-muted);
}
.s3-status-count { font-weight: 500; }
.s3-status-size, .s3-status-search { display: inline-flex; align-items: center; gap: 4px; }

/* Folder grid */
.s3-folders { margin-bottom: 16px; }
.s3-folders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.s3-fc {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 18px 10px 12px; border: 1px solid var(--border);
  border-radius: 12px; background: var(--surface); cursor: pointer;
  position: relative; transition: 120ms;
}
.s3-fc:hover { border-color: var(--accent); box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.s3-fc-icon { color: #f59e0b; }
.s3-fc-name {
  font-size: .84rem; text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
}
.s3-fc-actions {
  display: none; gap: 2px; margin-top: 2px;
}
.s3-fc:hover .s3-fc-actions { display: flex; }

/* File table */
.s3-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }
.s3-table { width: 100%; border-collapse: collapse; }
.s3-table th, .s3-table td { padding: 9px 10px; border-bottom: 1px solid var(--border); text-align: left; }
.s3-table th {
  font-size: .75rem; text-transform: uppercase; letter-spacing: .05em;
  color: var(--text-muted); font-weight: 500;
  background: var(--surface); position: sticky; top: 0; z-index: 1;
}
.s3-table tr:last-child td { border-bottom: none; }
.s3-th-cb { width: 36px; }
.s3-th-sort { cursor: pointer; user-select: none; white-space: nowrap; }
.s3-th-sort:hover { color: var(--text); }
.s3-th-type { width: 90px; }
.s3-th-size { width: 90px; }
.s3-th-date { width: 150px; }
.s3-th-actions { width: 120px; }
.s3-sort-off { opacity: .3; }
.s3-tr { transition: 50ms; }
.s3-tr:hover { background: var(--surface-strong); }
.s3-tr.sel { background: rgba(59,130,246,.06); }
.s3-td-cb { width: 36px; }
.s3-td-name { max-width: 0; cursor: pointer; }
.s3-td-num { white-space: nowrap; color: var(--text-muted); font-size: .85rem; }
.s3-file { display: flex; align-items: center; gap: 8px; }
.s3-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 450; }
.s3-td-actions { white-space: nowrap; }
.s3-date { display: inline-flex; align-items: center; gap: 4px; }

/* Badge */
.s3-badge {
  display: inline-flex; align-items: center; padding: 2px 8px;
  border-radius: 999px; font-size: .72rem; font-weight: 500; white-space: nowrap;
}

/* Action buttons in table */
.s3-td-actions { opacity: 0; transition: 80ms; }
.s3-tr:hover .s3-td-actions, .s3-tr.sel .s3-td-actions { opacity: 1; }

.s3-act {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border: none; border-radius: 5px;
  background: transparent; color: var(--text-muted); cursor: pointer; transition: 60ms;
}
.s3-act:hover { background: var(--surface-strong); color: var(--text); }
.s3-act-danger:hover { background: rgba(220,53,69,.12); color: #dc2626; }

/* Grid view */
.s3-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}
.s3-gc {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 16px 8px 10px; border: 1px solid var(--border);
  border-radius: 12px; background: var(--surface); cursor: pointer;
  position: relative; transition: 120ms;
}
.s3-gc:hover { border-color: var(--accent); box-shadow: 0 2px 8px rgba(0,0,0,.06); }
.s3-gc.sel { border-color: var(--accent); background: rgba(59,130,246,.04); }
.s3-gc-icon {
  display: flex; align-items: center; justify-content: center;
  width: 44px; height: 44px; border-radius: 10px; margin-bottom: 4px;
}
.s3-gc-name { font-size: .78rem; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.s3-gc-size { font-size: .72rem; color: var(--text-muted); }
.s3-gc-bar { height: 2px; border-radius: 1px; background: var(--accent); opacity: .2; margin-top: 2px; }
.s3-gc-actions {
  display: none; gap: 2px; margin-top: 4px;
}
.s3-gc:hover .s3-gc-actions { display: flex; }

/* ─── Info panel ─── */
.s3-panel-info {
  background: var(--surface); border-radius: 16px; border: 1px solid var(--border);
  box-shadow: 0 8px 32px rgba(0,0,0,.2); width: 400px; max-width: 90vw;
  max-height: 80vh; display: flex; flex-direction: column;
  animation: modalIn .2s ease;
}
.s3-pi-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--border);
}
.s3-pi-header h3 { margin: 0; font-size: 1rem; }
.s3-pi-body { padding: 16px 18px; display: grid; gap: 12px; overflow-y: auto; }
.s3-pi-icon { display: flex; justify-content: center; padding: 8px 0; }
.s3-pi-row { display: flex; flex-direction: column; gap: 2px; }
.s3-pi-label { font-size: .78rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }
.s3-pi-value { font-size: .9rem; word-break: break-all; }
.s3-pi-footer {
  display: flex; gap: 8px; padding: 12px 18px;
  border-top: 1px solid var(--border); justify-content: flex-end;
}

/* ─── Overlay / Modals ─── */
.s3-overlay {
  position: fixed; inset: 0; z-index: 5000;
  background: rgba(0,0,0,.35);
  display: flex; align-items: center; justify-content: center;
  animation: fadeIn .12s ease;
  backdrop-filter: blur(2px);
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes modalIn { from { transform: scale(.96); opacity: 0 } to { transform: scale(1); opacity: 1 } }

.s3-modal {
  background: var(--surface); border-radius: 16px; border: 1px solid var(--border);
  box-shadow: 0 8px 32px rgba(0,0,0,.2);
  width: 480px; max-width: 90vw; max-height: 85vh;
  display: flex; flex-direction: column; animation: modalIn .2s ease;
}
.s3-modal-sm { width: 420px; }
.s3-modal-confirm { width: 380px; align-items: center; text-align: center; padding: 24px; gap: 8px; }
.s3-modal-icon-warn { color: #f59e0b; margin-bottom: 4px; }
.s3-confirm-text { font-size: .9rem; color: var(--text-muted); margin: 4px 0; }
.s3-confirm-path { font-size: .82rem; color: var(--text-muted); background: var(--surface-strong); padding: 6px 10px; border-radius: 6px; word-break: break-all; }

.s3-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--border);
}
.s3-modal-header h3 { margin: 0; font-size: 1rem; display: flex; align-items: center; gap: 8px; }
.s3-modal-body { padding: 16px 18px; display: grid; gap: 14px; overflow-y: auto; flex: 1; }
.s3-modal-footer {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 8px; padding: 12px 18px; border-top: 1px solid var(--border);
}

/* ─── Form controls ─── */
.s3-form-row { display: grid; gap: 6px; }
.s3-label { display: grid; gap: 4px; font-size: .84rem; color: var(--text-muted); }
.s3-input {
  padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--background-soft); color: var(--text); font-size: .9rem;
}
.s3-input:focus { outline: none; border-color: var(--accent); }
.s3-path-preview {
  padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--surface-strong); color: var(--text-muted);
  font-size: .84rem; word-break: break-all;
}
.mono { font-family: 'SF Mono','Fira Code','Cascadia Code',monospace; font-size: .82rem; }

/* Dropzone */
.s3-dropzone {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 28px; border: 2px dashed var(--border);
  border-radius: 12px; background: var(--surface-strong);
  cursor: pointer; transition: 120ms;
}
.s3-dropzone:hover, .s3-dropzone.dragover {
  border-color: var(--accent); background: rgba(59,130,246,.04);
}
.s3-dropzone-icon { color: var(--text-muted); }
.s3-dropzone.dragover .s3-dropzone-icon { color: var(--accent); transform: translateY(-4px); }
.s3-dropzone-text { font-size: .85rem; color: var(--text-muted); }

/* Upload list */
.s3-upload-list { display: grid; gap: 4px; max-height: 160px; overflow-y: auto; }
.s3-upload-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 6px; background: var(--surface-strong);
}
.s3-upload-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .84rem; }
.s3-upload-size { font-size: .78rem; color: var(--text-muted); white-space: nowrap; }

/* Mini button */
.s3-btn-icon-sm {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border: none; border-radius: 7px;
  background: transparent; color: var(--text-muted); cursor: pointer; transition: 60ms;
}
.s3-btn-icon-sm:hover { background: var(--surface-strong); color: var(--text); }

/* Spin */
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

/* ─── Responsive ─── */
@media (max-width: 900px) {
  .s3-sidebar { display: none; }
  .s3-toolbar-left { width: 100%; }
  .s3-toolbar-right { width: 100%; justify-content: flex-start; }
  .s3-search { width: 100%; }
  .s3-search:focus-within { width: 100%; }
  .s3-btn-label { display: none; }
  .s3-th-date, .s3-th-type { display: none; }
  .s3-folders-grid { grid-template-columns: repeat(auto-fill, minmax(120px,1fr)); }
  .s3-grid { grid-template-columns: repeat(auto-fill, minmax(110px,1fr)); }
}
@media (max-width: 520px) {
  .s3-content { padding: 10px; }
  .s3-toolbar { padding: 8px 10px; }
  .s3-folders-grid { grid-template-columns: repeat(auto-fill, minmax(100px,1fr)); }
}
      `}</style>
    </div>
  );
}

// ─── FileActions dropdown ────────────────────────────────────────────────────

function FileActions({
  file,
  onDownload,
  onRename,
  onMap,
  onCopyPath,
  onDelete,
  onInfo,
}: {
  file: S3FileItem;
  onDownload: () => void;
  onRename: () => void;
  onMap: () => void;
  onCopyPath: () => void;
  onDelete: () => void;
  onInfo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="s3-act" onClick={() => setOpen(!open)} title="Thao tác">
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="s3-dropdown">
          <button onClick={() => { onDownload(); setOpen(false); }}>
            <Download size={14} /> Tải xuống
          </button>
          <button onClick={() => { onRename(); setOpen(false); }}>
            <Edit3 size={14} /> Đổi tên
          </button>
          <button onClick={() => { onMap(); setOpen(false); }}>
            <Link size={14} /> Ánh xạ layer
          </button>
          <button onClick={() => { onCopyPath(); setOpen(false); }}>
            <Copy size={14} /> Copy path
          </button>
          <button onClick={() => { onInfo(); setOpen(false); }}>
            <File size={14} /> Thông tin
          </button>
          <div className="s3-dropdown-divider" />
          <button className="danger" onClick={() => { onDelete(); setOpen(false); }}>
            <Trash2 size={14} /> Xóa
          </button>
        </div>
      )}
      <style jsx>{`
        .s3-dropdown {
          position: absolute; right: 0; top: 100%; z-index: 100;
          min-width: 180px; padding: 4px; margin-top: 2px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,.12);
          animation: fadeIn .1s ease;
        }
        .s3-dropdown button {
          display: flex; align-items: center; gap: 8px;
          width: 100%; padding: 7px 10px; border: none; border-radius: 6px;
          background: transparent; color: var(--text); cursor: pointer;
          font-size: .84rem; text-align: left; white-space: nowrap;
        }
        .s3-dropdown button:hover { background: var(--surface-strong); }
        .s3-dropdown button.danger { color: #dc2626; }
        .s3-dropdown button.danger:hover { background: rgba(220,53,69,.1); }
        .s3-dropdown-divider { height: 1px; background: var(--border); margin: 3px 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
