'use client';

import { useCallback, useEffect, useMemo, useState, useRef, Fragment, type DragEvent, type FormEvent } from 'react';
import { authService } from '../lib/auth';
import { getParentPath } from '../lib/utils/record-utils';
import {
  listS3Files,
  deleteS3File,
  downloadS3File,
  renameS3File,
  createS3Folder,
  renameS3Folder,
} from '../lib/admin-api';
import {
  RefreshCw,
  Search,
  MapPin,
  AlertCircle,
  Download,
  FileSpreadsheet,
  UploadCloud,
  FileCode,
  Trash2,
  Layers,
  Folder,
  FolderOpen,
  Copy,
  ChevronRight,
  ChevronDown,
  Plus,
  Move,
  Check,
  FolderPlus,
  CheckSquare,
  Square,
  Filter,
  Edit2,
  X,
  FileWarning,
} from 'lucide-react';

type S3FileEntry = {
  key: string;
  size: number;
  lastModified: string;
};

type FolderPalette = {
  accent: string;
  tint: string;
  border: string;
};

const FOLDER_PALETTES: FolderPalette[] = [
  { accent: '#2563a8', tint: 'rgba(37, 99, 168, 0.12)', border: 'rgba(37, 99, 168, 0.2)' },
  { accent: '#198754', tint: 'rgba(25, 135, 84, 0.12)', border: 'rgba(25, 135, 84, 0.2)' },
  { accent: '#fd7e14', tint: 'rgba(253, 126, 20, 0.12)', border: 'rgba(253, 126, 20, 0.2)' },
  { accent: '#0f766e', tint: 'rgba(15, 118, 110, 0.12)', border: 'rgba(15, 118, 110, 0.2)' },
  { accent: '#d63384', tint: 'rgba(214, 51, 132, 0.12)', border: 'rgba(214, 51, 132, 0.2)' },
  { accent: '#6f42c1', tint: 'rgba(111, 66, 193, 0.12)', border: 'rgba(111, 66, 193, 0.2)' },
];

function hashString(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function getFolderPalette(folderPath: string) {
  return FOLDER_PALETTES[hashString(folderPath) % FOLDER_PALETTES.length];
}

interface TreeNode {
  name: string;
  path: string;
  children: Record<string, TreeNode>;
}

export default function S3Explorer({
  prefix,
  onPreviewFile,
  refreshTrigger,
}: {
  prefix: string;
  onPreviewFile?: (file: S3FileEntry) => void;
  refreshTrigger?: number;
}) {
  const [files, setFiles] = useState<S3FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = useMemo(() => authService.hasRole('ADMIN') || authService.hasRole('DATA_MANAGER'), []);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  // Folder Navigation State
  const [currentDir, setCurrentDir] = useState(prefix);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([prefix]));

  // Sidebar tree folder search
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');

  // Inline Operations states
  const [editingFolderKey, setEditingFolderKey] = useState<string | null>(null);
  const [editingFolderValue, setEditingFolderValue] = useState('');
  const [creatingSubfolderKey, setCreatingSubfolderKey] = useState<string | null>(null);
  const [creatingSubfolderValue, setCreatingSubfolderValue] = useState('');
  const [hoveredNodeKey, setHoveredNodeKey] = useState<string | null>(null);

  // Advanced Filters
  const [filterType, setFilterType] = useState<'all' | 'raster' | 'vector' | 'csv' | 'image' | 'other'>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterDateStart, setFilterDateStart] = useState<string>('');
  const [filterDateEnd, setFilterDateEnd] = useState<string>('');
  const [searchRecursive, setSearchRecursive] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Bulk Operations
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [bulkTargetDir, setBulkTargetDir] = useState('');

  // Delete Confirmation Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<{ key: string; name: string }[]>([]);

  // Individual file move state
  const [showSingleMoveModal, setShowSingleMoveModal] = useState(false);
  const [singleMoveFile, setSingleMoveFile] = useState<S3FileEntry | null>(null);
  const [singleMoveDest, setSingleMoveDest] = useState('');

  // Sync currentDir with prefix when prefix changes
  useEffect(() => {
    setCurrentDir(prefix);
    setExpandedPaths(new Set([prefix]));
    setSelectedKeys(new Set());
  }, [prefix]);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { files: s3Files } = await listS3Files(prefix);
      setFiles(s3Files as S3FileEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách tệp');
    } finally {
      setLoading(false);
    }
  }, [prefix]);

  useEffect(() => {
    void fetchFiles();
  }, [fetchFiles, refreshTrigger]);

  const handleDownload = async (key: string) => {
    try {
      await downloadS3File(key);
    } catch (err) {
      alert('Lỗi tải tệp: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDelete = async (key: string) => {
    const shortKey = key.split('/').pop() || key;
    setDeleteTargets([{ key, name: shortKey }]);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const targets = deleteTargets;
    setShowDeleteModal(false);
    setDeleteTargets([]);
    if (targets.length === 0) return;

    try {
      setLoading(true);
      await Promise.all(targets.map((t) => deleteS3File(t.key)));
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        targets.forEach((t) => next.delete(t.key));
        return next;
      });
      await fetchFiles();
      alert(`Đã xóa thành công ${targets.length} tệp tin!`);
    } catch (err) {
      alert('Lỗi khi xóa: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleString('vi-VN');
  };

  const getFileIcon = (key: string) => {
    const ext = key.substring(key.lastIndexOf('.')).toLowerCase();
    if (['.tif', '.tiff', '.rst', '.cog'].includes(ext)) return { icon: Layers, color: '#0d6efd', type: 'Raster' };
    if (['.geojson', '.kml', '.shp', '.gpkg', '.zip'].includes(ext)) return { icon: MapPin, color: '#198754', type: 'Vector' };
    if (ext === '.csv') return { icon: FileSpreadsheet, color: '#6f42c1', type: 'CSV' };
    if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) return { icon: FileCode, color: '#fd7e14', type: 'Image' };
    return { icon: FileCode, color: 'var(--text-muted)', type: ext || 'File' };
  };

  const uniqueYears = useMemo(() => {
    const years = new Set<string>();
    for (const file of files) {
      if (file.lastModified) {
        const d = new Date(file.lastModified);
        if (!isNaN(d.getTime())) {
          years.add(String(d.getFullYear()));
        }
      }
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [files]);

  const fileMatchesFilters = useCallback(
    (file: S3FileEntry) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const filename = file.key.split('/').pop() || file.key;
        if (!filename.toLowerCase().includes(q) && !file.key.toLowerCase().includes(q)) {
          return false;
        }
      }

      if (filterType !== 'all') {
        const ext = file.key.substring(file.key.lastIndexOf('.')).toLowerCase();
        if (filterType === 'raster' && !['.tif', '.tiff', '.rst', '.cog'].includes(ext)) return false;
        if (filterType === 'vector' && !['.geojson', '.kml', '.shp', '.gpkg', '.zip'].includes(ext)) return false;
        if (filterType === 'csv' && ext !== '.csv') return false;
        if (filterType === 'image' && !['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) return false;
        if (
          filterType === 'other' &&
          ['.tif', '.tiff', '.rst', '.cog', '.geojson', '.kml', '.shp', '.gpkg', '.zip', '.csv', '.png', '.jpg', '.jpeg', '.gif'].includes(ext)
        )
          return false;
      }

      if (file.lastModified) {
        const d = new Date(file.lastModified);
        if (!isNaN(d.getTime())) {
          if (filterYear !== 'all' && String(d.getFullYear()) !== filterYear) return false;
          if (filterMonth !== 'all' && String(d.getMonth() + 1) !== filterMonth) return false;
          if (filterDateStart) {
            const start = new Date(filterDateStart);
            start.setHours(0, 0, 0, 0);
            if (d < start) return false;
          }
          if (filterDateEnd) {
            const end = new Date(filterDateEnd);
            end.setHours(23, 59, 59, 999);
            if (d > end) return false;
          }
        }
      }
      return true;
    },
    [searchQuery, filterType, filterYear, filterMonth, filterDateStart, filterDateEnd]
  );

  const filteredFiles = useMemo(() => {
    return files.filter(fileMatchesFilters);
  }, [files, fileMatchesFilters]);

  const { currentFolders, currentFiles } = useMemo(() => {
    const folders = new Set<string>();
    const fileList: S3FileEntry[] = [];
    for (const file of filteredFiles) {
      if (!file.key.startsWith(currentDir)) continue;
      const remaining = file.key.substring(currentDir.length);
      if (!remaining) continue;
      const slashIndex = remaining.indexOf('/');
      if (slashIndex !== -1) {
        const subfolderName = remaining.substring(0, slashIndex);
        folders.add(subfolderName);
      } else {
        const isDirPlaceholder = file.key.endsWith('/') || (file.size === 0 && !file.key.includes('.'));
        if (isDirPlaceholder) {
          const folderName = remaining;
          if (folderName) folders.add(folderName);
        } else {
          fileList.push(file);
        }
      }
    }
    return {
      currentFolders: Array.from(folders).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true })),
      currentFiles: fileList.sort((a, b) => {
        const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0;
        const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0;
        return dateB - dateA;
      }),
    };
  }, [filteredFiles, currentDir]);

  // Build Folder tree object
  const folderTree = useMemo(() => {
    const root: TreeNode = { name: 'Gốc', path: prefix, children: {} };
    for (const file of files) {
      const parent = getParentPath(file.key);
      if (!parent || !parent.startsWith(prefix)) continue;
      const relative = parent.substring(prefix.length);
      const segments = relative.split('/').filter(Boolean);
      let current = root;
      let currentPath = prefix;
      for (const segment of segments) {
        currentPath += segment + '/';
        if (!current.children[segment]) {
          current.children[segment] = {
            name: segment,
            path: currentPath,
            children: {},
          };
        }
        current = current.children[segment];
      }
    }
    return root;
  }, [files, prefix]);

  const allFoldersList = useMemo(() => {
    const folderPaths = new Set<string>();
    folderPaths.add(prefix);
    for (const file of files) {
      const parent = getParentPath(file.key);
      if (parent) {
        const normalized = parent.endsWith('/') ? parent : parent + '/';
        folderPaths.add(normalized);
      }
    }
    return Array.from(folderPaths).sort((a, b) => a.localeCompare(b));
  }, [files, prefix]);

  // Breadcrumb segments from currentDir
  const breadcrumbSegments = useMemo(() => {
    const segments: { name: string; path: string }[] = [];
    if (currentDir === prefix) {
      return [{ name: 'Gốc', path: prefix }];
    }
    const relative = currentDir.substring(prefix.length);
    const parts = relative.split('/').filter(Boolean);
    let accumulated = prefix;
    for (const part of parts) {
      accumulated += part + '/';
      segments.push({ name: part, path: accumulated });
    }
    return [{ name: 'Gốc', path: prefix }, ...segments];
  }, [currentDir, prefix]);

  // File counts per directory for tree badges
  const fileCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const file of files) {
      const parent = getParentPath(file.key);
      if (parent && !file.key.endsWith('/')) {
        map[parent] = (map[parent] || 0) + 1;
      }
    }
    return map;
  }, [files]);

  // Recursive file count under a path
  const getRecursiveFileCount = (path: string, counts: Record<string, number>) => {
    let total = counts[path] || 0;
    for (const [p, c] of Object.entries(counts)) {
      if (p !== path && p.startsWith(path)) {
        total += c;
      }
    }
    return total;
  };
  useEffect(() => {
    if (sidebarSearchQuery.trim()) {
      const query = sidebarSearchQuery.toLowerCase();
      const newExpanded = new Set<string>([prefix]);

      const traverseAndExpand = (node: TreeNode) => {
        let hasMatch = false;
        if (node.name.toLowerCase().includes(query) && node.path !== prefix) {
          hasMatch = true;
        }

        for (const child of Object.values(node.children)) {
          const childMatched = traverseAndExpand(child);
          if (childMatched) {
            hasMatch = true;
          }
        }

        if (hasMatch && node.path !== prefix) {
          newExpanded.add(node.path);
          // also add parents
          let parent = getParentPath(node.path.replace(/\/$/, ''));
          while (parent && parent.startsWith(prefix)) {
            newExpanded.add(parent.endsWith('/') ? parent : parent + '/');
            parent = getParentPath(parent.replace(/\/$/, ''));
          }
        }
        return hasMatch;
      };

      traverseAndExpand(folderTree);
      setExpandedPaths(newExpanded);
    }
  }, [sidebarSearchQuery, folderTree, prefix]);

  const togglePathExpanded = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAllFolders = () => {
    const allPaths = new Set<string>();
    const traverse = (node: TreeNode) => {
      allPaths.add(node.path);
      Object.values(node.children).forEach(traverse);
    };
    traverse(folderTree);
    setExpandedPaths(allPaths);
  };

  const collapseAllFolders = () => {
    setExpandedPaths(new Set([prefix]));
  };

  // Inline folder creation handler
  const handleInlineCreateFolder = async (parentPath: string, name: string) => {
    if (!name.trim()) {
      setCreatingSubfolderKey(null);
      return;
    }
    const cleanName = name.trim().replace(/[\/]/g, '_');
    const folderPath = parentPath + cleanName + '/';
    try {
      setLoading(true);
      await createS3Folder(folderPath);
      setCreatingSubfolderKey(null);
      setCreatingSubfolderValue('');
      await fetchFiles();
      // Auto expand parent
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        next.add(parentPath);
        return next;
      });
      alert('Tạo thư mục thành công!');
    } catch (err) {
      alert('Lỗi tạo thư mục: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Inline folder renaming handler
  const handleInlineRenameFolder = async (oldPath: string, newName: string) => {
    if (!newName.trim()) {
      setEditingFolderKey(null);
      return;
    }
    const cleanName = newName.trim().replace(/[\/]/g, '_');
    // Calculate new path prefix
    const parentPath = getParentPath(oldPath.replace(/\/$/, '')) + '/';
    const newPath = (parentPath === '/' ? '' : parentPath) + cleanName + '/';

    if (oldPath === newPath) {
      setEditingFolderKey(null);
      return;
    }

    try {
      setLoading(true);
      await renameS3Folder(oldPath, newPath);
      setEditingFolderKey(null);
      setEditingFolderValue('');
      // Update current Dir if we were inside the renamed folder
      if (currentDir.startsWith(oldPath)) {
        setCurrentDir(newPath + currentDir.substring(oldPath.length));
      }
      // Update expanded paths
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(oldPath)) {
          next.delete(oldPath);
          next.add(newPath);
        }
        return next;
      });
      await fetchFiles();
      alert('Đổi tên thư mục thành công!');
    } catch (err) {
      alert('Lỗi khi đổi tên thư mục: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  // Inline folder deletion (Deletes all files recursively)
  const handleInlineDeleteFolder = async (folderPath: string) => {
    const folderName = folderPath.replace(/\/$/, '').split('/').pop() || '';
    const filesToDelete = files.filter((f) => f.key.startsWith(folderPath));
    const targets = filesToDelete.length > 0
      ? filesToDelete.map((f) => ({ key: f.key, name: f.key.split('/').pop() || f.key }))
      : [{ key: folderPath, name: folderName }];
    setDeleteTargets(targets);
    setShowDeleteModal(true);
  };

  const handleMoveFile = async (sourceKey: string, destDir: string) => {
    const filename = sourceKey.split('/').pop() || '';
    if (!filename) return;
    const destinationKey = destDir + filename;
    if (sourceKey === destinationKey) return;
    try {
      setLoading(true);
      await renameS3File(sourceKey, destinationKey);
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(sourceKey);
        return next;
      });
      await fetchFiles();
    } catch (err) {
      alert('Lỗi di chuyển tệp tin: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleMoveSelected = async (destDir: string) => {
    const keys = Array.from(selectedKeys);
    if (keys.length === 0) return;
    try {
      setLoading(true);
      await Promise.all(
        keys.map((key) => {
          const filename = key.split('/').pop() || '';
          const destinationKey = destDir + filename;
          if (key === destinationKey) return Promise.resolve();
          return renameS3File(key, destinationKey);
        })
      );
      setSelectedKeys(new Set());
      setShowMoveModal(false);
      await fetchFiles();
      alert(`Đã di chuyển thành công ${keys.length} tệp tin!`);
    } catch (err) {
      alert('Lỗi di chuyển hàng loạt: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    const keys = Array.from(selectedKeys);
    if (keys.length === 0) return;
    const targets = keys.map((key) => ({ key, name: key.split('/').pop() || key }));
    setDeleteTargets(targets);
    setShowDeleteModal(true);
  };

  const handleQuickMoveToParent = async (file: S3FileEntry) => {
    const parentPath = getParentPath(file.key);
    if (!parentPath) return;
    const grandParent = getParentPath(parentPath.replace(/\/$/, '')) + '/';
    if (grandParent === prefix + '/') {
      await handleMoveFile(file.key, prefix);
    } else {
      await handleMoveFile(file.key, grandParent);
    }
  };

  const confirmSingleMove = async () => {
    if (!singleMoveFile || !singleMoveDest) return;
    const dest = singleMoveDest.endsWith('/') ? singleMoveDest : singleMoveDest + '/';
    await handleMoveFile(singleMoveFile.key, dest);
    setShowSingleMoveModal(false);
    setSingleMoveFile(null);
    setSingleMoveDest('');
  };

  const handleDownloadSelected = async () => {
    const keys = Array.from(selectedKeys);
    if (keys.length === 0) return;
    for (const key of keys) {
      try {
        await downloadS3File(key);
      } catch (err) {
        console.error('Lỗi tải tệp: ' + key, err);
      }
    }
  };

  const toggleSelectKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const currentViewFiles = searchRecursive ? filteredFiles : currentFiles;
  const isAllSelected = currentViewFiles.length > 0 && currentViewFiles.every((f) => selectedKeys.has(f.key));
  const toggleSelectAll = () => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (isAllSelected) currentViewFiles.forEach((f) => next.delete(f.key));
      else currentViewFiles.forEach((f) => next.add(f.key));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
  };
  const resetFilters = () => {
    setFilterType('all');
    setFilterYear('all');
    setFilterMonth('all');
    setFilterDateStart('');
    setFilterDateEnd('');
    setSearchQuery('');
  };

  const formatS3FolderDisplay = (path: string) => {
    if (path === prefix) return 'Thư mục gốc';
    const relative = path.substring(prefix.length);
    return relative.replace(/\/$/, '').split('/').join(' / ');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }} className="s3-explorer">
      <div className="s3-flat-toolbar">
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <div className="s3-flat-search-shell">
            <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Tìm tên tệp tin hoặc đường dẫn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="s3-flat-search-input"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="s3-clear-btn">
                ×
              </button>
            )}
          </div>
        </div>

        <div className="s3-toolbar-actions">
          <button
            onClick={() => setShowFiltersPanel(!showFiltersPanel)}
            className={`s3-flat-refresh-btn ${
              showFiltersPanel || filterType !== 'all' || filterYear !== 'all' || filterMonth !== 'all' || filterDateStart || filterDateEnd
                ? 'active-filter'
                : ''
            }`}
            title="Bộ lọc tệp tin"
          >
            <Filter size={15} />
            <span>Bộ lọc</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                setCreatingSubfolderKey(currentDir);
                setCreatingSubfolderValue('');
              }}
              className="s3-flat-refresh-btn"
              title="Tạo thư mục con trong thư mục hiện tại"
            >
              <FolderPlus size={15} color="var(--accent)" />
              <span>Thư mục mới</span>
            </button>
          )}

          <div className="view-mode-buttons">
            <button
              onClick={() => setViewMode('list')}
              className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
              title="Dạng danh sách"
            >
              <FileSpreadsheet size={15} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              title="Dạng lưới"
            >
              <Folder size={15} />
            </button>
          </div>

          <button onClick={() => void fetchFiles()} disabled={loading} className="s3-flat-refresh-btn">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {(showFiltersPanel || filterType !== 'all' || filterYear !== 'all' || filterMonth !== 'all' || filterDateStart || filterDateEnd) && (
        <div className="s3-filter-panel glass-panel slide-down">
          <div className="filter-grid">
            <div className="filter-item">
              <label>Loại tệp tin</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as typeof filterType)}>
                <option value="all">Tất cả định dạng</option>
                <option value="raster">Dữ liệu Raster (.tif, .tiff, .rst, .cog)</option>
                <option value="vector">Dữ liệu Vector (.geojson, .shp, .kml, .zip)</option>
                <option value="csv">Bảng dữ liệu CSV (.csv)</option>
                <option value="image">Hình ảnh (.png, .jpg, .jpeg)</option>
                <option value="other">Tệp tin khác</option>
              </select>
            </div>

            <div className="filter-item">
              <label>Năm ghi nhận</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                <option value="all">Tất cả năm</option>
                {uniqueYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Năm {yr}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <label>Tháng ghi nhận</label>
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
                <option value="all">Tất cả tháng</option>
                {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((m) => (
                  <option key={m} value={m}>
                    Tháng {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-item">
              <label>Khoảng ngày sửa đổi</label>
              <div className="date-range-inputs">
                <input type="date" value={filterDateStart} onChange={(e) => setFilterDateStart(e.target.value)} placeholder="Từ ngày" />
                <span>đến</span>
                <input type="date" value={filterDateEnd} onChange={(e) => setFilterDateEnd(e.target.value)} placeholder="Đến ngày" />
              </div>
            </div>
          </div>

          <div className="filter-footer">
            <label className="recursive-checkbox">
              <input type="checkbox" checked={searchRecursive} onChange={(e) => setSearchRecursive(e.target.checked)} />
              <span>Tìm kiếm đệ quy (Tìm cả trong thư mục con)</span>
            </label>

            <button onClick={resetFilters} className="reset-filter-btn">
              Xóa bộ lọc
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="s3-flat-error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => void fetchFiles()} className="retry-btn">
            Thử lại
          </button>
        </div>
      )}

      {loading && files.length === 0 ? (
        <div className="s3-flat-loading">
          <RefreshCw size={26} className="animate-spin" />
          <p>Đang tải danh sách tệp tin...</p>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="s3-flat-empty">
          <FileCode size={38} color="var(--border)" />
          <strong>Không tìm thấy tệp tin nào khớp với bộ lọc</strong>
          <span>Chọn bộ lọc hoặc tải tệp mới lên hệ thống</span>
        </div>
      ) : (
        <div className="s3-explorer-container">
          <div className="s3-explorer-main">
            {/* Breadcrumb Navigation */}
            <div className="s3-breadcrumb">
              {breadcrumbSegments.map((seg, idx) => {
                const isLast = idx === breadcrumbSegments.length - 1;
                const segCount = idx === 0 ? files.length : getRecursiveFileCount(seg.path, fileCountMap);
                return (
                  <Fragment key={seg.path}>
                    {idx > 0 && <ChevronRight size={13} className="breadcrumb-arrow" />}
                    <button
                      type="button"
                      className={`breadcrumb-segment ${isLast ? 'breadcrumb-current' : ''}`}
                      onClick={() => {
                        if (!isLast) {
                          setCurrentDir(seg.path);
                          setSelectedKeys(new Set());
                          setExpandedPaths((prev) => {
                            const next = new Set(prev);
                            next.add(seg.path);
                            return next;
                          });
                        }
                      }}
                      title={isLast ? seg.path : `Chuyển đến: ${seg.path}`}
                    >
                      {idx === 0 ? <Folder size={14} /> : null}
                      <span>{seg.name}</span>
                      <span className="breadcrumb-count">{segCount}</span>
                    </button>
                  </Fragment>
                );
              })}
              {isAdmin && (
                <button
                  type="button"
                  className="breadcrumb-new-folder-btn"
                  onClick={() => {
                    setCreatingSubfolderKey(currentDir);
                    setCreatingSubfolderValue('');
                  }}
                  title="Tạo thư mục con tại đây"
                >
                  <FolderPlus size={14} />
                </button>
              )}
            </div>

            {!searchRecursive && currentFolders.length > 0 && (
              <div className="folders-section">
                <h5 className="section-title">Thư mục con ({currentFolders.length})</h5>
                <div className="folders-grid">
                  {currentFolders.map((folderName) => {
                    const folderPath = currentDir + folderName + '/';
                    const palette = getFolderPalette(folderPath);

                    return (
                      <div
                        key={folderPath}
                        onClick={() => {
                          setCurrentDir(folderPath);
                          setSelectedKeys(new Set());
                        }}
                        className="folder-card"
                        style={{
                          borderColor: palette.border,
                          background: 'var(--surface)',
                        }}
                      >
                        <span className="folder-card-icon" style={{ color: palette.accent }}>
                          <Folder size={20} />
                        </span>
                        <span className="folder-card-name" title={folderName}>
                          {folderName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="files-section">
              <h5 className="section-title">
                Tệp tin ({searchRecursive ? filteredFiles.length : currentFiles.length})
                {searchRecursive && <span className="recursive-badge">Tìm kiếm đệ quy</span>}
              </h5>

              {currentViewFiles.length === 0 ? (
                <div className="empty-files-indicator">
                  <Folder size={24} color="var(--border)" />
                  <p>Thư mục này chưa có tệp trực tiếp. Nhập tệp mới hoặc mở thư mục con.</p>
                </div>
              ) : viewMode === 'list' ? (
                <div className="files-list-container">
                  <table className="files-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>
                          <button type="button" onClick={toggleSelectAll} className="select-all-checkbox-btn">
                            {isAllSelected ? (
                              <CheckSquare size={16} color="var(--accent)" />
                            ) : selectedKeys.size > 0 ? (
                              <div className="indeterminate-checkbox" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>
                        </th>
                        <th>Tên tệp</th>
                        {searchRecursive ? <th>Đường dẫn</th> : <th style={{ width: '140px' }}>Vị trí</th>}
                        <th>Định dạng</th>
                        <th>Kích thước</th>
                        <th>Ngày sửa đổi</th>
                        <th style={{ width: '130px', textAlign: 'right' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentViewFiles.map((file) => {
                        const filename = file.key.split('/').pop() || file.key;
                        const { icon: FileIcon, color, type } = getFileIcon(file.key);
                        const isSelected = selectedKeys.has(file.key);
                        const parent = getParentPath(file.key) || '/';

                        return (
                          <tr
                            key={file.key}
                            className={`file-row ${isSelected ? 'row-selected' : ''}`}
                          >
                            <td style={{ textAlign: 'center' }}>
                              <button type="button" onClick={() => toggleSelectKey(file.key)} className="select-checkbox-btn">
                                {isSelected ? (
                                  <CheckSquare size={16} color="var(--accent)" />
                                ) : (
                                  <Square size={16} color="var(--text-muted)" />
                                )}
                              </button>
                            </td>
                            <td>
                              <div
                                className="file-name-cell"
                                onClick={() => onPreviewFile?.(file)}
                                title="Click để xem trước"
                                style={{ cursor: onPreviewFile ? 'pointer' : 'default' }}
                              >
                                <span className="file-icon-wrapper" style={{ background: `${color}12`, color }}>
                                  <FileIcon size={14} />
                                </span>
                                <span className="file-name-text">{filename}</span>
                              </div>
                            </td>
                            <td className="file-path-cell" title={parent}>
                              <button
                                type="button"
                                className="path-nav-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const parentDir = getParentPath(file.key) || '';
                                  if (parentDir && parentDir.startsWith(prefix)) {
                                    const normalized = parentDir.endsWith('/') ? parentDir : parentDir + '/';
                                    setCurrentDir(normalized);
                                    setSelectedKeys(new Set());
                                    setExpandedPaths((prev) => {
                                      const next = new Set(prev);
                                      next.add(normalized);
                                      return next;
                                    });
                                  }
                                }}
                                title={`Đi đến: ${parent}`}
                              >
                                {formatS3FolderDisplay(parent)}
                              </button>
                            </td>
                            <td>
                              <span className="file-type-badge" style={{ background: `${color}15`, color }}>
                                {type}
                              </span>
                            </td>
                            <td className="monospace">{formatBytes(file.size)}</td>
                            <td className="file-date-cell">{formatDate(file.lastModified)}</td>
                            <td>
                              <div className="file-row-actions">
                                <button
                                  type="button"
                                  onClick={() => void navigator.clipboard.writeText(file.key)}
                                  className="s3-flat-icon-btn"
                                  title="Sao chép đường dẫn S3"
                                >
                                  <Copy size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleDownload(file.key)}
                                  className="s3-flat-icon-btn s3-flat-icon-btn-accent"
                                  title="Tải xuống tệp"
                                >
                                  <Download size={13} />
                                </button>
                                {isAdmin && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSingleMoveFile(file);
                                        setSingleMoveDest(currentDir);
                                        setShowSingleMoveModal(true);
                                      }}
                                      className="s3-flat-icon-btn s3-flat-icon-btn-move"
                                      title="Di chuyển tệp"
                                    >
                                      <Move size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDelete(file.key)}
                                      className="s3-flat-icon-btn s3-flat-icon-btn-danger"
                                      title="Xóa tệp"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="files-grid-layout">
                  {currentViewFiles.map((file) => {
                    const filename = file.key.split('/').pop() || file.key;
                    const { icon: FileIcon, color, type } = getFileIcon(file.key);
                    const isSelected = selectedKeys.has(file.key);

                    return (
                      <div
                        key={file.key}
                        className={`file-grid-card ${isSelected ? 'card-selected' : ''}`}
                        onClick={() => toggleSelectKey(file.key)}
                      >
                        <div className="card-checkbox-pos" onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={() => toggleSelectKey(file.key)} className="select-checkbox-btn">
                            {isSelected ? <CheckSquare size={16} color="var(--accent)" /> : <Square size={16} />}
                          </button>
                        </div>

                        <div
                          className="card-main-preview"
                          onClick={(e) => {
                            e.stopPropagation();
                            onPreviewFile?.(file);
                          }}
                        >
                          <span className="card-large-icon" style={{ background: `${color}10`, color }}>
                            <FileIcon size={32} />
                          </span>
                        </div>

                        <div className="card-info">
                          <span className="card-name" title={filename}>
                            {filename}
                          </span>
                          <div className="card-meta">
                            <span className="card-size">{formatBytes(file.size)}</span>
                            <span className="card-type" style={{ color }}>
                              {type}
                            </span>
                          </div>
                        </div>

                        <div className="card-hover-actions" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => void navigator.clipboard.writeText(file.key)} title="Sao chép đường dẫn S3">
                            <Copy size={12} />
                          </button>
                          <button onClick={() => void handleDownload(file.key)} title="Tải xuống tệp">
                            <Download size={12} />
                          </button>
                          {isAdmin && (
                            <button onClick={() => void handleDelete(file.key)} className="delete-btn" title="Xóa tệp">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedKeys.size > 0 && (
        <div className="s3-bulk-bar glass-panel fade-in">
          <div className="s3-bulk-info">
            <span className="s3-bulk-count">
              Đã chọn <strong>{selectedKeys.size}</strong> tệp tin
            </span>
            <button onClick={clearSelection} className="s3-bulk-deselect">
              Bỏ chọn
            </button>
          </div>

          <div className="s3-bulk-buttons">
            <button onClick={handleDownloadSelected} className="s3-bulk-btn s3-bulk-download" title="Tải xuống toàn bộ tệp đã chọn">
              <Download size={14} />
              <span>Tải xuống</span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => {
                    setBulkTargetDir(currentDir);
                    setShowMoveModal(true);
                  }}
                  className="s3-bulk-btn s3-bulk-move"
                  title="Di chuyển tệp đã chọn sang thư mục khác"
                >
                  <Move size={14} />
                  <span>Di chuyển</span>
                </button>

                <button onClick={handleDeleteSelected} className="s3-bulk-btn s3-bulk-delete" title="Xóa vĩnh viễn tệp đã chọn">
                  <Trash2 size={14} />
                  <span>Xóa đã chọn</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showMoveModal && (
        <div className="s3-modal-overlay fade-in" onClick={() => setShowMoveModal(false)}>
          <div className="s3-modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="s3-modal-header">
              <h4>Di chuyển {selectedKeys.size} tệp tin</h4>
              <button className="s3-modal-close" onClick={() => setShowMoveModal(false)}>
                ×
              </button>
            </div>

            <div className="s3-modal-body">
              <p>Chọn thư mục đích để di chuyển tệp:</p>
              <div className="s3-modal-folders-list custom-scrollbar">
                {allFoldersList.map((path) => {
                  const isCurrent = path === currentDir;
                  return (
                    <div
                      key={path}
                      onClick={() => setBulkTargetDir(path)}
                      className={`s3-modal-folder-row ${bulkTargetDir === path ? 'selected' : ''}`}
                    >
                      <Folder size={14} />
                      <span className="folder-row-path">{formatS3FolderDisplay(path)}</span>
                      {isCurrent && <span className="current-badge">Thư mục hiện tại</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="s3-modal-footer">
              <button onClick={() => void handleMoveSelected(bulkTargetDir)} className="s3-modal-btn-confirm" disabled={bulkTargetDir === currentDir}>
                Di chuyển ngay
              </button>
              <button onClick={() => setShowMoveModal(false)} className="s3-modal-btn-cancel">
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="s3-modal-overlay fade-in" onClick={() => setShowDeleteModal(false)}>
          <div className="s3-modal-content delete-modal glass-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="s3-modal-header" style={{ borderBottomColor: 'rgba(220, 53, 69, 0.15)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc3545' }}>
                <FileWarning size={20} />
                Xác nhận xóa {deleteTargets.length > 1 ? `${deleteTargets.length} tệp tin` : 'tệp tin'}
              </h4>
              <button className="s3-modal-close" onClick={() => setShowDeleteModal(false)}>
                ×
              </button>
            </div>

            <div className="s3-modal-body">
              {deleteTargets.length <= 15 ? (
                <div className="delete-files-list custom-scrollbar" style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {deleteTargets.map((t, i) => (
                    <div key={t.key} className="delete-file-row" style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '6px 8px', borderRadius: '6px', fontSize: '0.82rem',
                      background: i % 2 === 0 ? 'var(--background-soft)' : 'transparent',
                    }}>
                      <Trash2 size={13} color="#dc3545" style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.key}>
                        {t.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="delete-files-list custom-scrollbar" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    {deleteTargets.slice(0, 10).map((t, i) => (
                      <div key={t.key} className="delete-file-row" style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 8px', borderRadius: '6px', fontSize: '0.82rem',
                        background: i % 2 === 0 ? 'var(--background-soft)' : 'transparent',
                      }}>
                        <Trash2 size={13} color="#dc3545" style={{ flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.key}>
                          {t.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    ...và {deleteTargets.length - 10} tệp tin khác
                  </p>
                </>
              )}
              <p style={{ margin: '8px 0 0 0', fontSize: '0.82rem', color: '#dc3545', fontWeight: '600', textAlign: 'center' }}>
                Thao tác này không thể hoàn tác!
              </p>
            </div>

            <div className="s3-modal-footer" style={{ borderTopColor: 'rgba(220, 53, 69, 0.15)' }}>
              <button onClick={() => { setShowDeleteModal(false); setDeleteTargets([]); }} className="s3-modal-btn-cancel">
                Hủy
              </button>
              <button onClick={() => void confirmDelete()} className="s3-modal-btn-delete" style={{
                background: '#dc3545', color: 'white', border: 'none',
                borderRadius: 'var(--radius-md)', padding: '8px 16px',
                fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer',
              }}>
                Xóa vĩnh viễn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single File Move Modal */}
      {showSingleMoveModal && singleMoveFile && (
        <div className="s3-modal-overlay fade-in" onClick={() => { setShowSingleMoveModal(false); setSingleMoveFile(null); }}>
          <div className="s3-modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="s3-modal-header">
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Move size={18} color="var(--accent)" />
                Di chuyển: {singleMoveFile.key.split('/').pop() || singleMoveFile.key}
              </h4>
              <button className="s3-modal-close" onClick={() => { setShowSingleMoveModal(false); setSingleMoveFile(null); }}>
                ×
              </button>
            </div>

            <div className="s3-modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Tìm thư mục..."
                  value={singleMoveDest}
                  onChange={(e) => setSingleMoveDest(e.target.value)}
                  style={{
                    flex: 1, padding: '8px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--background-soft)',
                    color: 'var(--text)', fontSize: '0.85rem', outline: 'none',
                  }}
                />
              </div>
              <div className="s3-modal-folders-list custom-scrollbar" style={{ maxHeight: '300px' }}>
                {allFoldersList.filter((p) => 
                  !singleMoveDest || p.toLowerCase().includes(singleMoveDest.toLowerCase())
                ).map((path) => {
                  const isCurrent = path === currentDir;
                  const fileParent = getParentPath(singleMoveFile.key) || '';
                  const isSameParent = path === (fileParent.endsWith('/') ? fileParent : fileParent + '/');
                  return (
                    <div
                      key={path}
                      onClick={() => setSingleMoveDest(path)}
                      className={`s3-modal-folder-row ${singleMoveDest === path ? 'selected' : ''}`}
                    >
                      <Folder size={14} color={isSameParent ? 'var(--text-muted)' : 'var(--accent)'} />
                      <span className="folder-row-path" style={{ color: isSameParent ? 'var(--text-muted)' : 'var(--text)' }}>
                        {formatS3FolderDisplay(path)}
                      </span>
                      {isCurrent && <span className="current-badge">Hiện tại</span>}
                      {isSameParent && <span className="current-badge" style={{ background: 'var(--border)' }}>Nguồn</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="s3-modal-footer">
              <button onClick={() => { setShowSingleMoveModal(false); setSingleMoveFile(null); }} className="s3-modal-btn-cancel">
                Hủy
              </button>
              <button
                onClick={() => void confirmSingleMove()}
                className="s3-modal-btn-confirm"
                disabled={!singleMoveDest || singleMoveDest === (getParentPath(singleMoveFile.key) + '/')}
              >
                Di chuyển
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .s3-explorer-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-height: 550px;
        }

        .s3-tree-sidebar {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 16px 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 650px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
        }

        .sidebar-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
        }

        .sidebar-title {
          margin: 0;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .sidebar-controls {
          display: flex;
          gap: 4px;
        }

        .sidebar-controls button {
          background: none;
          border: none;
          padding: 4px;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s, color 0.15s;
        }

        .sidebar-controls button:hover {
          background: var(--surface-strong);
          color: var(--accent);
        }

        .sidebar-filter {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--background-soft);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 4px 8px;
          font-size: 0.8rem;
        }

        .sidebar-filter input {
          border: none;
          background: none;
          color: var(--text);
          outline: none;
          width: 100%;
          font-size: 0.78rem;
        }

        .sidebar-filter button {
          border: none;
          background: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.9rem;
          padding: 0 2px;
        }

        .tree-container {
          flex: 1;
          overflow-y: auto;
          padding-right: 4px;
        }

        .tree-node-wrapper {
          display: flex;
          flex-direction: column;
        }

        .tree-node {
          display: flex;
          align-items: center;
          padding: 6px 8px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.15s ease-in-out;
          font-size: 0.85rem;
          color: var(--text);
          user-select: none;
          border: 1.5px solid transparent;
          position: relative;
        }

        .tree-node:hover {
          background: var(--surface-strong);
        }

        .tree-node-actions {
          display: none;
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          background: var(--surface-strong);
          border-radius: 4px;
          padding: 2px;
          gap: 2px;
          box-shadow: var(--shadow-sm);
        }

        .tree-node:hover .tree-node-actions {
          display: flex;
        }

        .tree-node-actions button {
          border: none;
          background: none;
          cursor: pointer;
          color: var(--text-muted);
          padding: 3px;
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tree-node-actions button:hover {
          background: var(--border);
          color: var(--accent);
        }

        .tree-node-actions button.danger-action:hover {
          background: rgba(220, 53, 69, 0.1);
          color: #dc3545;
        }

        .tree-node.active {
          background: rgba(37, 99, 168, 0.08);
          color: var(--accent);
          font-weight: 600;
        }

        .tree-node.drag-over {
          border-color: var(--accent);
          border-style: dashed;
          background: rgba(37, 99, 168, 0.12);
          transform: scale(1.02);
        }

        .tree-toggle {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          padding: 0;
          margin-right: 4px;
          border-radius: 4px;
          transition: background 0.15s;
        }

        .tree-toggle:hover {
          background: var(--border);
        }

        .tree-toggle-spacer {
          width: 22px;
        }

        .tree-node-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
        }

        .inline-rename-form,
        .inline-create-form {
          display: flex;
          align-items: center;
          gap: 4px;
          flex: 1;
        }

        .inline-rename-form input,
        .inline-create-form input {
          flex: 1;
          font-size: 0.8rem;
          padding: 2px 6px;
          border: 1px solid var(--accent);
          border-radius: 4px;
          outline: none;
          background: var(--surface);
          color: var(--text);
        }

        .inline-action-btn-save {
          background: var(--accent);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .inline-action-btn-cancel {
          background: var(--surface-strong);
          color: var(--text-muted);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tree-inline-create {
          display: flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: var(--radius-md);
          background: rgba(var(--accent), 0.03);
          margin-top: 2px;
          margin-bottom: 2px;
        }

        /* Connecting nesting lines like Windows Explorer */
        .tree-node-children {
          display: flex;
          flex-direction: column;
          margin-top: 2px;
          position: relative;
          padding-left: 6px;
          border-left: 1px dashed var(--border);
          margin-left: 14px;
        }

        .s3-explorer-main {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .s3-flat-toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }

        .s3-flat-search-shell {
          display: flex;
          align-items: center;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 8px 14px;
          gap: 8px;
        }

        .s3-flat-search-input {
          border: none;
          background: none;
          outline: none;
          color: var(--text);
          font-size: 0.88rem;
          width: 100%;
        }

        .s3-clear-btn {
          border: none;
          background: none;
          color: var(--text-muted);
          font-size: 1.2rem;
          cursor: pointer;
          padding: 0 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .s3-clear-btn:hover {
          color: var(--text);
        }

        .s3-toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }

        .s3-flat-refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 8px 16px;
          color: var(--text);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .s3-flat-refresh-btn:hover {
          background: var(--surface-strong);
          border-color: var(--text-muted);
        }

        .view-mode-buttons {
          display: flex;
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
          background: var(--surface);
        }

        .view-mode-btn {
          border: none;
          background: none;
          padding: 8px 12px;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: all 0.2s;
        }

        .view-mode-btn.active {
          background: var(--surface-strong);
          color: var(--accent);
        }

        .s3-filter-panel {
          padding: 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-sm);
        }

        .filter-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
        }

        .filter-item {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .filter-item label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .filter-item select,
        .filter-item input {
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--background-soft);
          color: var(--text);
          font-size: 0.85rem;
          outline: none;
          transition: all 0.2s;
        }

        .filter-item select:focus,
        .filter-item input:focus {
          border-color: var(--accent);
          background: var(--surface);
        }

        .date-range-inputs {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .date-range-inputs input {
          flex: 1;
          min-width: 0;
        }

        .date-range-inputs span {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .filter-footer {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px dashed var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .recursive-checkbox {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
          color: var(--text);
          cursor: pointer;
        }

        .recursive-checkbox input {
          width: 15px;
          height: 15px;
          cursor: pointer;
        }

        .reset-filter-btn {
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--surface-strong);
          color: var(--text);
          padding: 6px 12px;
          font-size: 0.82rem;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .reset-filter-btn:hover {
          background: var(--border);
          border-color: var(--text-muted);
        }

        .active-filter {
          border-color: var(--accent) !important;
          color: var(--accent) !important;
          background: rgba(37, 99, 168, 0.06) !important;
        }

        .folders-section,
        .files-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .section-title {
          margin: 0;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .recursive-badge {
          background: rgba(37, 99, 168, 0.08);
          color: var(--accent);
          font-size: 0.72rem;
          padding: 2px 8px;
          border-radius: 99px;
          text-transform: none;
          font-weight: 500;
        }

        .folders-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
        }

        .folder-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          background: var(--surface);
          border: 1.5px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: all 0.18s ease;
          position: relative;
        }

        .folder-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
          border-color: var(--text-muted);
        }

        .folder-card.drag-over {
          border-color: var(--accent) !important;
          border-style: dashed;
          background: rgba(37, 99, 168, 0.1) !important;
          transform: scale(1.03);
        }

        .folder-card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
        }

        .folder-card-name {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .empty-files-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          border: 1px dashed var(--border);
          border-radius: var(--radius-xl);
          background: var(--background-soft);
          color: var(--text-muted);
          gap: 8px;
          text-align: center;
        }

        .empty-files-indicator p {
          margin: 0;
          font-size: 0.85rem;
        }

        .files-list-container {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }

        .files-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .files-table th {
          background: var(--background-soft);
          padding: 12px 16px;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          border-bottom: 1px solid var(--border);
        }

        .files-table td {
          padding: 10px 16px;
          border-bottom: 1px solid var(--border);
          font-size: 0.88rem;
          vertical-align: middle;
        }

        .file-row {
          transition: background 0.15s;
        }

        .file-row:hover {
          background: var(--surface-strong);
        }

        .file-row.row-selected {
          background: rgba(37, 99, 168, 0.05);
        }

        .file-row.row-selected:hover {
          background: rgba(37, 99, 168, 0.08);
        }

        .select-checkbox-btn,
        .select-all-checkbox-btn {
          border: none;
          background: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 4px;
          color: var(--text-muted);
        }

        .select-checkbox-btn:hover,
        .select-all-checkbox-btn:hover {
          background: var(--border);
        }

        .indeterminate-checkbox {
          width: 12px;
          height: 12px;
          background: var(--accent);
          border-radius: 2px;
        }

        .file-name-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
          color: var(--text);
        }

        .file-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 6px;
        }

        .file-name-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 280px;
        }

        .file-path-cell {
          color: var(--text-muted);
          font-size: 0.78rem;
          max-width: 200px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-type-badge {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          text-transform: uppercase;
        }

        .monospace {
          font-family: monospace;
          font-size: 0.8rem;
          color: var(--text);
        }

        .file-date-cell {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .file-row-actions {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
        }

        .s3-flat-icon-btn {
          border: none;
          background: none;
          cursor: pointer;
          color: var(--text-muted);
          padding: 6px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s, color 0.2s;
        }

        .s3-flat-icon-btn:hover {
          background: var(--surface-strong);
          color: var(--text);
        }

        .s3-flat-icon-btn-accent:hover {
          background: rgba(37, 99, 168, 0.1);
          color: var(--accent);
        }

        .s3-flat-icon-btn-danger:hover {
          background: rgba(220, 53, 69, 0.1);
          color: #dc3545;
        }

        .s3-flat-icon-btn-move:hover {
          background: rgba(253, 126, 20, 0.1);
          color: #fd7e14;
        }

        /* Breadcrumb navigation */
        .s3-breadcrumb {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 10px 14px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          flex-wrap: wrap;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
        }

        .breadcrumb-segment {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border: 1px solid transparent;
          border-radius: var(--radius-md);
          background: none;
          color: var(--text-muted);
          font-size: 0.82rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.18s ease;
          white-space: nowrap;
        }

        .breadcrumb-segment:hover {
          background: var(--surface-strong);
          color: var(--accent);
          border-color: var(--border);
        }

        .breadcrumb-segment.breadcrumb-current {
          color: var(--text);
          font-weight: 700;
          cursor: default;
          background: var(--background-soft);
        }

        .breadcrumb-count {
          font-size: 0.65rem;
          color: var(--text-muted);
          background: var(--border);
          padding: 1px 6px;
          border-radius: 99px;
          font-weight: 600;
          margin-left: 2px;
        }

        .breadcrumb-current .breadcrumb-count {
          background: var(--accent);
          color: white;
        }

        .breadcrumb-arrow {
          color: var(--border);
          flex-shrink: 0;
        }

        .breadcrumb-new-folder-btn {
          background: none;
          border: 1px dashed var(--border);
          border-radius: var(--radius-md);
          padding: 5px 8px;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          margin-left: auto;
          transition: all 0.18s ease;
        }

        .breadcrumb-new-folder-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: rgba(37, 99, 168, 0.04);
        }

        /* Path navigation cell */
        .path-nav-btn {
          border: none;
          background: none;
          color: var(--text-muted);
          font-size: 0.78rem;
          cursor: pointer;
          padding: 2px 6px;
          border-radius: 4px;
          max-width: 200px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: all 0.15s;
          text-decoration: underline;
          text-decoration-style: dotted;
          text-underline-offset: 2px;
        }

        .path-nav-btn:hover {
          color: var(--accent);
          background: rgba(37, 99, 168, 0.06);
          text-decoration-style: solid;
        }

        .tree-count-badge {
          transition: all 0.15s;
        }

        /* Delete file list */
        .delete-files-list {
          border: 1px solid rgba(220, 53, 69, 0.15);
          border-radius: var(--radius-md);
          background: var(--background-soft);
          padding: 4px;
        }

        .delete-file-row:hover {
          background: rgba(220, 53, 69, 0.05) !important;
        }

        .files-grid-layout {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 16px;
        }

        .file-grid-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: var(--shadow-xs);
        }

        .file-grid-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-md);
          border-color: var(--text-muted);
        }

        .file-grid-card.card-selected {
          border-color: var(--accent);
          background: rgba(37, 99, 168, 0.03);
          box-shadow: 0 4px 15px rgba(37, 99, 168, 0.08);
        }

        .card-checkbox-pos {
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 2;
        }

        .card-main-preview {
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-lg);
          background: var(--background-soft);
          margin-top: 6px;
        }

        .card-large-icon {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .card-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-meta {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
        }

        .card-size {
          color: var(--text-muted);
        }

        .card-type {
          font-weight: 700;
          text-transform: uppercase;
        }

        .card-hover-actions {
          position: absolute;
          top: 10px;
          right: 10px;
          display: flex;
          gap: 4px;
          opacity: 0;
          transform: translateY(-5px);
          transition: all 0.2s ease;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 2px;
          box-shadow: var(--shadow-sm);
        }

        .file-grid-card:hover .card-hover-actions {
          opacity: 1;
          transform: translateY(0);
        }

        .card-hover-actions button {
          border: none;
          background: none;
          cursor: pointer;
          color: var(--text-muted);
          padding: 5px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-hover-actions button:hover {
          background: var(--surface-strong);
          color: var(--text);
        }

        .card-hover-actions button.delete-btn:hover {
          background: rgba(220, 53, 69, 0.1);
          color: #dc3545;
        }

        .s3-flat-error {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(220, 53, 69, 0.08);
          color: #dc3545;
          padding: 12px 16px;
          border-radius: var(--radius-xl);
          font-size: 0.88rem;
          border: 1px solid rgba(220, 53, 69, 0.15);
        }

        .retry-btn {
          border: 1px solid #dc3545;
          background: var(--surface);
          color: #dc3545;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 0.78rem;
          cursor: pointer;
          font-weight: 600;
          margin-left: auto;
          transition: all 0.2s;
        }

        .retry-btn:hover {
          background: #dc3545;
          color: white;
        }

        .s3-flat-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          color: var(--text-muted);
          gap: 12px;
        }

        .s3-flat-loading p {
          margin: 0;
          font-size: 0.88rem;
        }

        .s3-flat-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 80px 20px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          color: var(--text-muted);
          gap: 12px;
          text-align: center;
        }

        .s3-flat-empty strong {
          color: var(--text);
          font-size: 0.95rem;
        }

        .s3-flat-empty span {
          font-size: 0.82rem;
        }

        /* Bulk Action Bar styling */
        .s3-bulk-bar {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 100;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 99px;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          gap: 32px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
        }

        .s3-bulk-info {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.88rem;
          color: var(--text);
        }

        .s3-bulk-deselect {
          border: none;
          background: none;
          color: var(--accent);
          cursor: pointer;
          font-weight: 600;
          text-decoration: underline;
        }

        .s3-bulk-buttons {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .s3-bulk-btn {
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 99px;
          padding: 8px 16px;
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .s3-bulk-btn:hover {
          background: var(--surface-strong);
        }

        .s3-bulk-download:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: rgba(37, 99, 168, 0.04);
        }

        .s3-bulk-move:hover {
          border-color: #fd7e14;
          color: #fd7e14;
          background: rgba(253, 126, 20, 0.04);
        }

        .s3-bulk-delete {
          border-color: rgba(220, 53, 69, 0.2);
          color: #dc3545;
        }

        .s3-bulk-delete:hover {
          background: rgba(220, 53, 69, 0.06);
          border-color: #dc3545;
        }

        /* Modal styling */
        .s3-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(15, 23, 42, 0.3);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .s3-modal-content {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          width: 450px;
          max-width: 90%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .s3-modal-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .s3-modal-header h4 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          color: var(--text);
        }

        .s3-modal-close {
          border: none;
          background: none;
          font-size: 1.5rem;
          color: var(--text-muted);
          cursor: pointer;
        }

        .s3-modal-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .s3-modal-body p {
          margin: 0;
          font-size: 0.88rem;
          color: var(--text-muted);
        }

        .s3-modal-folders-list {
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          max-height: 200px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          background: var(--background-soft);
        }

        .s3-modal-folder-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          cursor: pointer;
          font-size: 0.85rem;
          color: var(--text);
          border-bottom: 1px solid var(--border);
          transition: background 0.15s;
        }

        .s3-modal-folder-row:last-child {
          border-bottom: none;
        }

        .s3-modal-folder-row:hover {
          background: var(--surface-strong);
        }

        .s3-modal-folder-row.selected {
          background: rgba(37, 99, 168, 0.08);
          color: var(--accent);
          font-weight: 600;
        }

        .folder-row-path {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .current-badge {
          background: var(--border);
          color: var(--text-muted);
          font-size: 0.7rem;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .s3-modal-footer {
          padding: 14px 20px;
          background: var(--background-soft);
          border-top: 1px solid var(--border);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .s3-modal-btn-confirm {
          background: var(--accent);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          padding: 8px 16px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }

        .s3-modal-btn-confirm:disabled {
          background: var(--border);
          color: var(--text-muted);
          cursor: not-allowed;
        }

        .s3-modal-btn-cancel {
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: var(--radius-md);
          padding: 8px 16px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }

        .s3-modal-btn-cancel:hover {
          background: var(--surface-strong);
        }

        /* Utility classes */
        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .fade-in {
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .slide-down {
          animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-10px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        /* Custom Scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
