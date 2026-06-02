"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "../../../components/layout/app-header";
import { AppFooter } from "../../../components/layout/app-footer";
import { AuthGuard } from "../../../components/auth/AuthGuard";
import { authService } from "../../../lib/auth";
import {
  createAdminUser,
  deleteAdminUser,
  exportMonthlyXlsx,
  listAdminUsers,
  listMonthlyExportFiles,
  listSourceFiles,
  loadCurrentAccount,
  loadDataDevices,
  loadDataRows,
  loadDataTimeframes,
  refreshMonthlyExport,
  triggerDataFetch,
  listGisLayers,
  listLayerFolderTree,
  createLayerFolder,
  deleteLayerFolder,
  uploadLayerFile,
  type AdminRole,
  type AdminUser,
  type AdminUserForm,
  type GisLayer,
  type LayerFolderDto,
  updateAdminUser,
} from "../../../lib/admin-api";
import S3Manager from "../../../components/admin/S3Manager";
import { DATA_SOURCE_OPTIONS, type DataSourceKey, type EcowittDevice } from "../../../lib/constants/data-sources";
import { collectRecordKeys, formatRecordValue, type DataRecord } from "../../../lib/utils/record-utils";
import {
  Activity,
  Database,
  Download,
  FolderOpen,
  Folder,
  FolderPlus,
  File,
  RefreshCw,
  Upload,
  Search,
  Server,
  Shield,
  Users,
} from "lucide-react";

const EMPTY_USER_FORM: AdminUserForm = {
  username: "",
  email: "",
  password: "",
  role: "DATA_MANAGER",
  enabled: true,
};

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes)) {
    return "-";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("vi-VN");
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeAdminTab, setActiveAdminTab] = useState<"overview" | "users" | "storage" | "data" | "gis">("overview");
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userSaving, setUserSaving] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userForm, setUserForm] = useState<AdminUserForm>(EMPTY_USER_FORM);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [dataSource, setDataSource] = useState<DataSourceKey>("mekong");
  const [deviceId, setDeviceId] = useState("");
  const [ecowittDevices, setEcowittDevices] = useState<EcowittDevice[]>([]);
  const [dataDate, setDataDate] = useState("");
  const [dataRows, setDataRows] = useState<DataRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [timeframes, setTimeframes] = useState<Array<{ fetch_run_id: string; fetched_at: string; device_id?: string }>>([]);
  const [timeframesLoading, setTimeframesLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [sourceFiles, setSourceFiles] = useState<Array<{ name: string; modifiedAt: string; size: number }>>([]);
  const [sourceFilesLoading, setSourceFilesLoading] = useState(true);
  const [monthlyFiles, setMonthlyFiles] = useState<Array<{ name: string; modifiedAt: string; size: number }>>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().getMonth() + 1);
  const [monthlyMetric, setMonthlyMetric] = useState("salinity");
  const [layers, setLayers] = useState<GisLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<number | null>(null);
  const [folderTree, setFolderTree] = useState<LayerFolderDto[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [uploadCategory, setUploadCategory] = useState("default");
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"success" | "error" | "info">("info");
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const dataColumns = useMemo(() => collectRecordKeys(dataRows).slice(0, 8), [dataRows]);
  const previewRows = useMemo(() => dataRows.slice(0, 10), [dataRows]);
  const selectedTimeframe = useMemo(
    () => timeframes.find((timeframe) => timeframe.fetch_run_id === selectedRunId) || null,
    [selectedRunId, timeframes],
  );

  const pushMessage = (text: string, kind: "success" | "error" | "info" = "info") => {
    setMessage(text);
    setMessageKind(kind);
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      setUsers(await listAdminUsers());
    } catch (error) {
      pushMessage(error instanceof Error ? error.message : "Không tải được danh sách user", "error");
    } finally {
      setUsersLoading(false);
    }
  };

  const loadS3Files = async () => {};

  const loadData = useCallback(
    async (runId?: string) => {
      if (!runId) {
        setDataRows([]);
        return;
      }

      setDataLoading(true);
      try {
        setDataRows(await loadDataRows(dataSource, dataDate || undefined, runId, deviceId || undefined));
      } catch (error) {
        pushMessage(error instanceof Error ? error.message : "Không tải được dữ liệu", "error");
        setDataRows([]);
      } finally {
        setDataLoading(false);
      }
    },
    [dataDate, dataSource, deviceId],
  );

  const loadSourceFilesData = async () => {
    setSourceFilesLoading(true);
    try {
      setSourceFiles(await listSourceFiles(dataSource));
    } catch (error) {
      pushMessage(error instanceof Error ? error.message : "Không tải được file nguồn", "error");
      setSourceFiles([]);
    } finally {
      setSourceFilesLoading(false);
    }
  };

  const loadMonthlyFilesData = async () => {
    setMonthlyLoading(true);
    try {
      setMonthlyFiles(await listMonthlyExportFiles());
    } catch (error) {
      pushMessage(error instanceof Error ? error.message : "Không tải được file Excel tháng", "error");
      setMonthlyFiles([]);
    } finally {
      setMonthlyLoading(false);
    }
  };

  const loadAccount = async () => {
    try {
      const account = await loadCurrentAccount();
      setCurrentUser(account);
    } catch {
      authService.logout();
      router.replace("/auth");
    }
  };

  const loadLayers = async () => {
    try {
      const data = await listGisLayers();
      setLayers(data);
    } catch {
      setLayers([]);
    }
  };

  const loadFolderTree = async (layerId: number) => {
    try {
      const data = await listLayerFolderTree(layerId);
      setFolderTree(data);
    } catch {
      setFolderTree([]);
    }
  };

  useEffect(() => {
    if (selectedLayerId) {
      void loadFolderTree(selectedLayerId);
    } else {
      setFolderTree([]);
    }
  }, [selectedLayerId]);

  const refreshAll = async () => {
    await Promise.all([loadAccount(), loadUsers(), loadS3Files(), loadData(), loadSourceFilesData(), loadMonthlyFilesData(), loadLayers()]);
  };

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dataDate) {
      setTimeframes([]);
      setSelectedRunId("");
      setDataRows([]);
      return;
    }

    const fetchTimeframes = async () => {
      setTimeframesLoading(true);
      setSelectedRunId("");
      setDataRows([]);
      try {
        const fetchedTimeframes = await loadDataTimeframes(dataSource, dataDate, deviceId || undefined);
        setTimeframes(fetchedTimeframes);
        setSelectedRunId((currentRunId) =>
          fetchedTimeframes.some((timeframe) => timeframe.fetch_run_id === currentRunId) ? currentRunId : "",
        );
      } catch (error) {
        pushMessage(error instanceof Error ? error.message : "Không tải được danh sách khung giờ", "error");
        setTimeframes([]);
        setSelectedRunId("");
      } finally {
        setTimeframesLoading(false);
      }
    };

    void fetchTimeframes();
  }, [dataDate, dataSource, deviceId]);

  useEffect(() => {
    void loadData(selectedRunId);

    // Load device list from API for ecowitt
    if (dataSource === "ecowitt") {
      const loadFromApi = async () => {
        try {
          const res = await fetch('/api/ecowitt/devices');
          const data = await res.json();
          if (data.devices && Array.isArray(data.devices) && data.devices.length > 0) {
            setEcowittDevices(data.devices);
            return;
          }
        } catch {}
        try {
          const devices = await loadDataDevices("ecowitt");
          if (devices.length > 0) {
            setEcowittDevices(devices.map((d) => ({ id: d.device_id, name: `Trạm ${d.device_id}` })));
          }
        } catch {}
      };
      loadFromApi();
    }
  }, [loadData, selectedRunId]);

  const handleUserSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setUserSaving(true);

    try {
      if (editingUserId) {
        await updateAdminUser(editingUserId, userForm);
        pushMessage("Đã cập nhật user", "success");
      } else {
        await createAdminUser(userForm);
        pushMessage("Đã tạo user mới", "success");
      }

      setEditingUserId(null);
      setUserForm(EMPTY_USER_FORM);
      await loadUsers();
    } catch (error) {
      pushMessage(error instanceof Error ? error.message : "Lưu user thất bại", "error");
    } finally {
      setUserSaving(false);
    }
  };

  const startEditUser = (user: AdminUser) => {
    setEditingUserId(user.id);
    setUserForm({
      username: user.username,
      email: user.email,
      password: "",
      role: user.role,
      enabled: user.enabled,
    });
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`Xóa user ${user.username}?`)) {
      return;
    }

    setBusyAction(`delete-user-${user.id}`);
    try {
      await deleteAdminUser(user.id);
      pushMessage("Đã xóa user", "success");
      await loadUsers();
    } catch (error) {
      pushMessage(error instanceof Error ? error.message : "Xóa user thất bại", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const handleUnifiedUpload = async () => {
    if (!uploadFile) {
      pushMessage("Chọn file để upload", "error");
      return;
    }
    if (!selectedLayerId) {
      pushMessage("Chọn Layer để upload file bản đồ", "error");
      return;
    }

    setBusyAction("upload-unified");
    try {
      await uploadLayerFile(selectedLayerId, uploadFile, selectedFolderId || undefined, uploadCategory);
      pushMessage("Đã upload và ánh xạ file thành công", "success");
      setUploadFile(null);
      await loadS3Files(); // Refresh S3 list too
    } catch (error) {
      pushMessage(error instanceof Error ? error.message : "Upload thất bại", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!selectedLayerId) return;
    const name = window.prompt("Nhập tên thư mục mới:");
    if (!name) return;

    try {
      await createLayerFolder(selectedLayerId, name, selectedFolderId || undefined);
      pushMessage("Đã tạo thư mục", "success");
      await loadFolderTree(selectedLayerId);
    } catch (error) {
      pushMessage(error instanceof Error ? error.message : "Tạo thư mục thất bại", "error");
    }
  };

  const handleDeleteFolder = async (folderId: number) => {
    if (!confirm("Xóa thư mục này và tất cả nội dung bên trong?")) return;

    try {
      await deleteLayerFolder(folderId);
      pushMessage("Đã xóa thư mục", "success");
      if (selectedFolderId === folderId) setSelectedFolderId(null);
      if (selectedLayerId) await loadFolderTree(selectedLayerId);
    } catch (error) {
      pushMessage(error instanceof Error ? error.message : "Xóa thư mục thất bại", "error");
    }
  };

  const handleFetchData = async () => {
    setBusyAction("fetch-data");
    try {
      const result = await triggerDataFetch(dataSource);
      pushMessage(result.message, "success");
      await Promise.all([selectedRunId ? loadData(selectedRunId) : loadData(), loadSourceFilesData(), loadMonthlyFilesData()]);
    } catch (error) {
      pushMessage(error instanceof Error ? error.message : "Lấy dữ liệu thất bại", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRefreshMonthly = async () => {
    setBusyAction("refresh-monthly");
    try {
      const result = await refreshMonthlyExport();
      pushMessage(result.message, "success");
      await loadMonthlyFilesData();
    } catch (error) {
      pushMessage(error instanceof Error ? error.message : "Cập nhật Excel tháng thất bại", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportMonthly = async () => {
    setBusyAction("export-monthly");
    try {
      await exportMonthlyXlsx(monthlyYear, monthlyMonth, monthlyMetric);
      pushMessage("Đã xuất file Excel tháng", "success");
      await loadMonthlyFilesData();
    } catch (error) {
      pushMessage(error instanceof Error ? error.message : "Xuất Excel thất bại", "error");
    } finally {
      setBusyAction(null);
    }
  };

  const userCount = users.length;
  const dataCount = dataRows.length;
  const sourceFileCount = sourceFiles.length;
  const adminTabs = [
    { key: "overview" as const, label: "Tổng quan", icon: Activity },
    { key: "users" as const, label: "Người dùng", icon: Users },
    { key: "storage" as const, label: "S3", icon: Server },
    { key: "gis" as const, label: "GIS Layers", icon: FolderOpen },
    { key: "data" as const, label: "Dữ liệu", icon: Database },
    ];
  return (
    <AuthGuard requiredRole="ADMIN">
      <div className="app-container admin-container">
        <AppHeader />

        <main className="app-main admin-main">
          <section className="admin-hero">
            <div className="admin-hero-copy">
              <p className="kicker">Dashboard quản trị</p>
              <h1 className="hero-title">Quản lý user, S3 và dữ liệu vận hành</h1>
              <p className="hero-description">
                Màn hình này gom các chức năng quản trị chính vào một giao diện đồng bộ với trang chủ hiện tại.
              </p>
            </div>
            <div className="admin-hero-meta">
              <div className="meta-chip">
                <Shield size={16} />
                {currentUser?.role || "ADMIN"}
              </div>
              <div className="meta-chip">
                <Users size={16} />
                {currentUser?.username || "admin"}
              </div>
              <div className="meta-chip">
                <Activity size={16} />
                Sẵn sàng
              </div>
            </div>
          </section>

          {message && (
            <div className={`admin-banner admin-banner-${messageKind}`}>
              {message}
            </div>
          )}

          <nav className="admin-tabs" aria-label="Dashboard sections">
            {adminTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeAdminTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`admin-tab ${active ? "is-active" : ""}`}
                  onClick={() => setActiveAdminTab(tab.key)}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {activeAdminTab === "overview" && (
            <section className="admin-overview">
              <section className="admin-summary-grid">
                <article className="admin-summary-card">
                  <Users size={20} />
                  <span>Users</span>
                  <strong>{userCount}</strong>
                </article>
                <article className="admin-summary-card">
                  <Database size={20} />
                  <span>Data rows</span>
                  <strong>{dataCount}</strong>
                </article>
                <article className="admin-summary-card">
                  <FolderOpen size={20} />
                  <span>Source files</span>
                  <strong>{sourceFileCount}</strong>
                </article>
              </section>

              <article className="admin-card admin-overview-card">
                <div className="admin-card-header">
                  <div>
                    <p className="card-kicker">Quick actions</p>
                    <h2>Lối tắt quản trị</h2>
                  </div>
                </div>

                <div className="quick-actions-grid">
                  <button className="quick-action" type="button" onClick={() => setActiveAdminTab("users")}>
                    <Users size={18} />
                    <span>
                      <strong>Người dùng</strong>
                      <em>Tạo, sửa, xóa tài khoản</em>
                    </span>
                  </button>
                  <button className="quick-action" type="button" onClick={() => setActiveAdminTab("storage")}>
                    <Server size={18} />
                    <span>
                      <strong>S3</strong>
                      <em>Upload, tải xuống, xóa file</em>
                    </span>
                  </button>
                  <button className="quick-action" type="button" onClick={() => setActiveAdminTab("gis")}>
                    <FolderOpen size={18} />
                    <span>
                      <strong>GIS Layers</strong>
                      <em>Quản lý bản đồ & thư mục</em>
                    </span>
                  </button>
                  <button className="quick-action" type="button" onClick={() => setActiveAdminTab("data")}>
                    <Database size={18} />
                    <span>
                      <strong>Dữ liệu</strong>
                      <em>Đồng bộ, export, snapshot</em>
                    </span>
                  </button>
                </div>
              </article>
            </section>
          )}

          {activeAdminTab === "users" && (
            <section className="admin-tab-panel">
              <article className="admin-card">
                <div className="admin-card-header">
                  <div>
                    <p className="card-kicker">User management</p>
                    <h2>Người dùng</h2>
                  </div>
                  <button className="ghost-btn" onClick={loadUsers} type="button" disabled={usersLoading}>
                    <RefreshCw size={16} />
                    Làm mới
                  </button>
                </div>

                <form className="admin-form" onSubmit={handleUserSubmit}>
                  <div className="form-grid">
                    <label>
                      Tên đăng nhập
                      <input
                        value={userForm.username}
                        onChange={(event) => setUserForm((current) => ({ ...current, username: event.target.value }))}
                        required
                        minLength={3}
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={userForm.email}
                        onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Mật khẩu {editingUserId ? "(để trống nếu giữ nguyên)" : ""}
                      <input
                        type="password"
                        value={userForm.password}
                        onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                        minLength={editingUserId ? 0 : 6}
                        required={!editingUserId}
                      />
                    </label>
                    <label>
                      Role
                      <select
                        value={userForm.role}
                        onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value as AdminRole }))}
                      >
                        <option value="USER">USER</option>
                        <option value="DATA_MANAGER">DATA_MANAGER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={userForm.enabled}
                        onChange={(event) => setUserForm((current) => ({ ...current, enabled: event.target.checked }))}
                      />
                      Enabled
                    </label>
                  </div>

                  <div className="form-actions">
                    <button className="primary-btn" type="submit" disabled={userSaving}>
                      {userSaving ? "Đang lưu..." : editingUserId ? "Cập nhật user" : "Tạo user"}
                    </button>
                    {editingUserId && (
                      <button
                        className="ghost-btn"
                        type="button"
                        onClick={() => {
                          setEditingUserId(null);
                          setUserForm(EMPTY_USER_FORM);
                        }}
                      >
                        Hủy sửa
                      </button>
                    )}
                  </div>
                </form>

                <div className="admin-table-wrap">
                  {usersLoading ? (
                    <p className="muted">Đang tải...</p>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Role</th>
                          <th>Trạng thái</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td>
                              <strong>{user.username}</strong>
                              <div className="subtle">{user.email}</div>
                            </td>
                            <td>{user.role}</td>
                            <td>{user.enabled ? "Enabled" : "Disabled"}</td>
                            <td className="row-actions">
                              <button type="button" className="mini-btn" onClick={() => startEditUser(user)}>
                                Sửa
                              </button>
                              <button
                                type="button"
                                className="mini-btn danger"
                                onClick={() => handleDeleteUser(user)}
                                disabled={busyAction === `delete-user-${user.id}`}
                              >
                                Xóa
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </article>
            </section>
          )}

          {activeAdminTab === "storage" && (
            <section className="admin-tab-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <article className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
                <S3Manager />
              </article>
            </section>
          )}

          {activeAdminTab === "gis" && (
            <section className="admin-tab-panel">
              <div className="admin-grid" style={{ gridTemplateColumns: "300px 1fr" }}>
                <div className="admin-column">
                  <article className="admin-card">
                    <div className="admin-card-header">
                      <div>
                        <p className="card-kicker">Cấu trúc thư mục</p>
                        <h2>Thư mục Layer</h2>
                      </div>
                    </div>
                    <div className="admin-card-body">
                      <div className="form-group">
                        <label>Chọn Layer để quản lý thư mục</label>
                        <select
                          value={selectedLayerId || ""}
                          onChange={(e) => setSelectedLayerId(Number(e.target.value) || null)}
                          style={{ border: !selectedLayerId ? "2px solid #3b82f6" : undefined }}
                        >
                          <option value="">-- Chọn Layer --</option>
                          {layers.map(l => (
                            <option key={l.id} value={l.id}>{l.layerName}</option>
                          ))}
                        </select>
                      </div>

                      <div className="folder-tree" style={{ marginTop: "16px", minHeight: "200px" }}>
                        {!selectedLayerId ? (
                          <div className="empty-state" style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                            <Folder size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
                            <p>Vui lòng chọn một Layer bên trên để quản lý cấu trúc thư mục.</p>
                          </div>
                        ) : (
                          <>
                            <div
                              className={`folder-item ${selectedFolderId === null ? "active" : ""}`}
                              onClick={() => setSelectedFolderId(null)}
                            >
                              <Folder size={16} /> <span>Root (Gốc)</span>
                            </div>
                            <div className="folder-list" style={{ marginLeft: "12px" }}>
                              {folderTree.map(folder => (
                                <div key={folder.id} className="folder-node">
                                  <div
                                    className={`folder-item ${selectedFolderId === folder.id ? "active" : ""}`}
                                    onClick={() => setSelectedFolderId(folder.id)}
                                  >
                                    <Folder size={16} /> <span>{folder.name}</span>
                                    <button
                                      className="mini-btn danger"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                                    >
                                      x
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <button
                              className="ghost-btn"
                              style={{ marginTop: "12px", width: "100%", justifyContent: "center" }}
                              onClick={handleCreateFolder}
                            >
                              <FolderPlus size={16} /> <span>Tạo thư mục mới</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                </div>

                <div className="admin-column">
                  <article className="admin-card">
                    <div className="admin-card-header">
                      <div>
                        <p className="card-kicker">Quản lý file</p>
                        <h2>File trong thư mục</h2>
                      </div>
                    </div>
                    <div className="admin-card-body">
                      {!selectedLayerId ? (
                        <div className="empty-state">Vui lòng chọn một Layer để quản lý file</div>
                      ) : (
                        <>
                          <div className="upload-box" style={{ marginBottom: "24px", padding: "16px", background: "#f9fafb", borderRadius: "8px" }}>
                            <h3>Upload file mới vào {selectedFolderId ? "thư mục đã chọn" : "Root"}</h3>
                            <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "12px", marginTop: "12px" }}>
                              <div className="form-group">
                                <label>Chọn file bản đồ (.tif, .zip...)</label>
                                <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                              </div>
                              <div className="form-group">
                                <label>Category (loại dữ liệu)</label>
                                <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                                  <option value="default">Mặc định</option>
                                  <option value="raster">Raster / Map</option>
                                  <option value="vector">Vector / Shape</option>
                                  <option value="document">Tài liệu</option>
                                  <option value="backup">Backup</option>
                                </select>
                              </div>
                              <div className="form-group" style={{ alignSelf: "end" }}>
                                <button
                                  className="primary-btn"
                                  onClick={handleUnifiedUpload}
                                  disabled={busyAction === "upload-unified" || !uploadFile}
                                >
                                  <Upload size={16} /> <span>Upload</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="file-info-note" style={{ fontSize: "0.85rem", color: "#666", marginBottom: "12px" }}>
                            Sử dụng <strong>backend-controlled storage</strong>: Path S3 sẽ được backend tự động sinh dựa trên cấu trúc thư mục bạn chọn.
                          </div>

                          {/* List of files mapped to this layer/folder could go here by calling GET /api/gis/layers/{id}/objects */}
                          <div className="empty-state">
                            Tính năng liệt kê file theo thư mục đang được đồng bộ...
                            <br />
                            Bạn có thể xem các file đã upload trong tab &quot;Dữ liệu&quot; hoặc &quot;S3&quot;.                          </div>
                        </>
                      )}
                    </div>
                  </article>
                </div>
              </div>
            </section>
          )}

          {activeAdminTab === "data" && (
            <section className="admin-tab-panel">              <div className="admin-grid">
                <div className="admin-column">
                  <article className="admin-card">
                    <div className="admin-card-header">
                      <div>
                        <p className="card-kicker">Data pipeline</p>
                        <h2>Đồng bộ dữ liệu</h2>
                      </div>
                      <button className="ghost-btn" onClick={() => loadData(selectedRunId)} type="button" disabled={dataLoading || !selectedRunId}>
                        <RefreshCw size={16} />
                        Tải lại
                      </button>
                    </div>

                    <div className="admin-form">
                      <div className="form-grid">
                        <label>
                          Nguồn dữ liệu
                          <select value={dataSource} onChange={(event) => setDataSource(event.target.value as DataSourceKey)}>
                            {DATA_SOURCE_OPTIONS.map((option) => (
                              <option key={option.key} value={option.key}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        {dataSource === 'ecowitt' && (
                          <label>
                            Thiết bị
                            <select value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
                              <option value="">Tất cả</option>
                              {ecowittDevices.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label>
                          Ngày lọc
                          <input type="date" value={dataDate} onChange={(event) => setDataDate(event.target.value)} />
                        </label>
                        <label>
                          Khung giờ đã lưu
                          <select
                            value={selectedRunId}
                            onChange={(event) => setSelectedRunId(event.target.value)}
                            disabled={timeframesLoading || !dataDate}
                          >
                            <option value="">Chọn khung giờ</option>
                            {timeframesLoading ? (
                              <option>Đang tải...</option>
                            ) : (
                              timeframes.map((tf) => (
                                <option key={tf.fetch_run_id} value={tf.fetch_run_id}>
                                  {new Date(tf.fetched_at).toLocaleTimeString("vi-VN")}
                                </option>
                              ))
                            )}
                          </select>
                        </label>
                      </div>

                      <div className="timeframe-picker">
                        <div className="timeframe-picker-header">
                          <span className="muted">
                            {dataDate
                              ? `${timeframes.length} khung giờ có dữ liệu trong ngày ${new Date(`${dataDate}T00:00:00`).toLocaleDateString("vi-VN")}`
                              : "Chọn ngày để xem các khung giờ đã lưu"}
                          </span>
                          {selectedTimeframe ? (
                            <span className="badge">
                              Đang xem {new Date(selectedTimeframe.fetched_at).toLocaleTimeString("vi-VN")}
                            </span>
                          ) : null}
                        </div>

                        <div className="timeframe-chip-list">
                          {timeframes.length === 0 ? (
                            <span className="muted">{dataDate ? "Chưa có snapshot nào trong ngày này" : "Chưa chọn ngày"}</span>
                          ) : (
                            timeframes.map((tf) => {
                              const isActive = tf.fetch_run_id === selectedRunId;
                              return (
                                <button
                                  key={tf.fetch_run_id}
                                  type="button"
                                  className={`timeframe-chip${isActive ? " is-active" : ""}`}
                                  onClick={() => setSelectedRunId(tf.fetch_run_id)}
                                  disabled={timeframesLoading}
                                >
                                  {new Date(tf.fetched_at).toLocaleTimeString("vi-VN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="form-actions">
                        <button className="primary-btn" type="button" onClick={handleFetchData} disabled={busyAction === "fetch-data"}>
                          <Database size={16} />
                          Chạy đồng bộ
                        </button>
                        <button className="ghost-btn" type="button" onClick={() => loadData(selectedRunId)} disabled={dataLoading || !selectedRunId}>
                          <Search size={16} />
                          Tải lại dữ liệu
                        </button>
                      </div>
                    </div>

                    <div className="data-preview">
                      {dataLoading ? (
                        <p className="muted">Đang tải dữ liệu...</p>
                      ) : previewRows.length === 0 ? (
                        <p className="muted">{selectedRunId ? "Chưa có dữ liệu trong khung giờ này" : "Chọn một khung giờ để xem dữ liệu"}</p>
                      ) : (
                        <table className="admin-table">
                          <thead>
                            <tr>
                              {dataColumns.map((column) => (
                                <th key={column}>{column}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((row, index) => (
                              <tr key={`${index}-${String(row.id || index)}`}>
                                {dataColumns.map((column) => (
                                  <td key={column}>{formatRecordValue(row[column])}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </article>
                </div>

                <div className="admin-column">
                  <article className="admin-card">
                    <div className="admin-card-header">
                      <div>
                        <p className="card-kicker">Monthly export</p>
                        <h2>Excel tháng</h2>
                      </div>
                      <button className="ghost-btn" onClick={loadMonthlyFilesData} type="button" disabled={monthlyLoading}>
                        <RefreshCw size={16} />
                        Làm mới
                      </button>
                    </div>

                    <div className="admin-form">
                      <div className="form-grid">
                        <label>
                          Năm
                          <input type="number" value={monthlyYear} onChange={(event) => setMonthlyYear(Number(event.target.value))} />
                        </label>
                        <label>
                          Tháng
                          <input type="number" min={1} max={12} value={monthlyMonth} onChange={(event) => setMonthlyMonth(Number(event.target.value))} />
                        </label>
                        <label>
                          Chỉ số
                          <select value={monthlyMetric} onChange={(event) => setMonthlyMetric(event.target.value)}>
                            <option value="salinity">salinity</option>
                            <option value="ph">ph</option>
                            <option value="waterlevel">waterlevel</option>
                          </select>
                        </label>
                      </div>

                      <div className="form-actions">
                        <button className="primary-btn" type="button" onClick={handleExportMonthly} disabled={busyAction === "export-monthly"}>
                          <Download size={16} />
                          Xuất file
                        </button>
                        <button className="ghost-btn" type="button" onClick={handleRefreshMonthly} disabled={busyAction === "refresh-monthly"}>
                          <RefreshCw size={16} />
                          Cập nhật
                        </button>
                      </div>
                    </div>

                    <div className="admin-table-wrap">
                      {monthlyLoading ? (
                        <p className="muted">Đang tải...</p>
                      ) : (
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>File</th>
                              <th>Kích thước</th>
                              <th>Cập nhật</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyFiles.map((file) => (
                              <tr key={file.name}>
                                <td className="key-cell">{file.name}</td>
                                <td>{formatSize(file.size)}</td>
                                <td>{formatDate(file.modifiedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </article>

                  <article className="admin-card">
                    <div className="admin-card-header">
                      <div>
                        <p className="card-kicker">Source files</p>
                        <h2>Snapshot dữ liệu</h2>
                      </div>
                      <button className="ghost-btn" onClick={loadSourceFilesData} type="button" disabled={sourceFilesLoading}>
                        <RefreshCw size={16} />
                        Làm mới
                      </button>
                    </div>

                    <div className="admin-table-wrap">
                      {sourceFilesLoading ? (
                        <p className="muted">Đang tải...</p>
                      ) : (
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Tên file</th>
                              <th>Kích thước</th>
                              <th>Cập nhật</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sourceFiles.map((file) => (
                              <tr key={file.name}>
                                <td className="key-cell">{file.name}</td>
                                <td>{formatSize(file.size)}</td>
                                <td>{formatDate(file.modifiedAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </article>
                </div>
              </div>
            </section>
          )}
        </main>

        <AppFooter />

        <style jsx>{`
          .admin-main {
            background: var(--background);
            gap: 1rem;
            padding: 1.25rem 1.5rem 2rem;
            overflow: auto;
          }

          .admin-hero {
            display: flex;
            justify-content: space-between;
            gap: 1rem;
            padding: 1.4rem 1.6rem;
            border: 1px solid var(--border);
            border-radius: 18px;
            background: linear-gradient(135deg, rgba(13, 110, 253, 0.08), rgba(13, 110, 253, 0.02));
            box-shadow: var(--shadow-sm);
          }

          .admin-hero-meta {
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
            min-width: 180px;
          }

          .meta-chip {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.55rem 0.8rem;
            border-radius: 999px;
            background: var(--surface);
            border: 1px solid var(--border);
            font-size: 0.9rem;
          }

          .admin-banner {
            padding: 0.85rem 1rem;
            border-radius: 12px;
            border: 1px solid var(--border);
            background: var(--surface);
          }

          .admin-banner-success {
            border-color: rgba(25, 135, 84, 0.35);
            color: var(--success);
          }

          .admin-banner-error {
            border-color: rgba(220, 53, 69, 0.35);
            color: var(--danger);
          }

          .admin-banner-info {
            color: var(--text-muted);
          }

          .admin-tabs {
            display: flex;
            gap: 0.5rem;
            padding: 0.25rem;
            border: 1px solid var(--border);
            border-radius: 999px;
            background: var(--surface-strong);
            overflow-x: auto;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .admin-tabs::-webkit-scrollbar {
            display: none;
          }

          .admin-tab {
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
            padding: 0.7rem 1rem;
            border: 1px solid transparent;
            border-radius: 999px;
            background: transparent;
            color: var(--text-muted);
            cursor: pointer;
            white-space: nowrap;
            transition: 120ms ease;
          }

          .admin-tab:hover {
            color: var(--text);
          }

          .admin-tab.is-active {
            background: var(--surface);
            color: var(--accent);
            border-color: var(--border);
            box-shadow: var(--shadow-sm);
          }

          .admin-overview,
          .admin-tab-panel {
            display: grid;
            gap: 1rem;
          }

          .admin-summary-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 0.9rem;
          }

          .admin-summary-card,
          .admin-card {
            border: 1px solid var(--border);
            border-radius: 18px;
            background: var(--surface);
            box-shadow: var(--shadow-sm);
          }

          .admin-summary-card {
            display: grid;
            gap: 0.35rem;
            padding: 1rem 1.1rem;
          }

          .admin-summary-card strong {
            font-size: 1.4rem;
          }

          .admin-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
            align-items: start;
          }

          .admin-column {
            display: grid;
            gap: 1rem;
          }

          .quick-actions-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.85rem;
          }

          .quick-action {
            display: flex;
            align-items: flex-start;
            gap: 0.7rem;
            padding: 0.95rem 1rem;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface-strong);
            color: var(--text);
            cursor: pointer;
            text-align: left;
            transition: 120ms ease;
          }

          .quick-action:hover {
            border-color: var(--accent);
            box-shadow: var(--shadow-sm);
            transform: translateY(-1px);
          }

          .quick-action span {
            display: grid;
            gap: 0.2rem;
          }

          .quick-action strong {
            font-size: 0.98rem;
          }

          .quick-action em {
            font-style: normal;
            color: var(--text-muted);
            font-size: 0.85rem;
          }

          .admin-card {
            padding: 1rem;
          }

          .admin-card-header {
            display: flex;
            align-items: start;
            justify-content: space-between;
            gap: 1rem;
            margin-bottom: 0.85rem;
          }

          .admin-card h2 {
            margin: 0.15rem 0 0;
            font-size: 1.1rem;
          }

          .card-kicker,
          .kicker {
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-size: 0.75rem;
            color: var(--text-muted);
          }

          .hero-title {
            margin: 0.35rem 0 0;
          }

          .hero-description {
            margin: 0.7rem 0 0;
            color: var(--text-muted);
            max-width: 70ch;
          }

          .admin-form {
            display: grid;
            gap: 0.9rem;
            margin-bottom: 1rem;
          }

          .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.75rem;
          }

          .form-grid label {
            display: grid;
            gap: 0.35rem;
            font-size: 0.9rem;
          }

          .form-grid input,
          .form-grid select {
            padding: 0.7rem 0.8rem;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: var(--background-soft);
            color: var(--text);
          }

          .checkbox-label {
            display: flex !important;
            align-items: center;
            gap: 0.5rem;
          }

          .form-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.65rem;
          }

          .primary-btn,
          .ghost-btn,
          .mini-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
            border-radius: 10px;
            border: 1px solid transparent;
            cursor: pointer;
            transition: 120ms ease;
          }

          .primary-btn {
            padding: 0.75rem 1rem;
            background: var(--accent);
            color: white;
          }

          .primary-btn:hover {
            background: var(--accent-hover);
          }

          .ghost-btn {
            padding: 0.7rem 0.95rem;
            background: var(--surface-strong);
            color: var(--text);
            border-color: var(--border);
          }

          .mini-btn {
            padding: 0.45rem 0.75rem;
            background: var(--surface-strong);
            color: var(--text);
            border-color: var(--border);
          }

          .mini-btn.danger {
            background: rgba(220, 53, 69, 0.08);
            color: var(--danger);
          }

          .ghost-btn:disabled,
          .primary-btn:disabled,
          .mini-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }

          .admin-table-wrap {
            overflow: auto;
            border-radius: 12px;
          }

          .admin-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.92rem;
          }

          .admin-table th,
          .admin-table td {
            padding: 0.7rem 0.65rem;
            border-bottom: 1px solid var(--border);
            text-align: left;
            vertical-align: top;
          }

          .admin-table th {
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-muted);
          }

          .subtle,
          .muted {
            color: var(--text-muted);
            font-size: 0.85rem;
          }

          .row-actions {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
          }

          .key-cell {
            max-width: 240px;
            word-break: break-word;
          }

          .timeframe-picker {
            display: grid;
            gap: 0.75rem;
            padding: 0.9rem;
            border: 1px solid var(--border);
            border-radius: 12px;
            background: var(--background-soft);
          }

          .timeframe-picker-header {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 0.6rem;
          }

          .timeframe-chip-list {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .timeframe-chip {
            padding: 0.5rem 0.75rem;
            border: 1px solid var(--border);
            border-radius: 999px;
            background: var(--surface-strong);
            color: var(--text);
            cursor: pointer;
          }

          .timeframe-chip.is-active {
            border-color: var(--accent);
            background: rgba(59, 130, 246, 0.12);
            color: var(--accent);
            font-weight: 600;
          }

          .badge {
            display: inline-flex;
            align-items: center;
            padding: 0.3rem 0.6rem;
            border-radius: 999px;
            background: rgba(59, 130, 246, 0.12);
            color: var(--accent);
            font-size: 0.8rem;
            font-weight: 600;
          }

          .data-preview {
            overflow: auto;
          }

          @media (max-width: 1180px) {
            .admin-summary-grid,
            .admin-grid,
            .quick-actions-grid {
              grid-template-columns: 1fr;
            }

            .admin-hero {
              flex-direction: column;
            }

            .admin-hero-meta {
              min-width: 0;
              flex-direction: row;
              flex-wrap: wrap;
            }
          }

          @media (max-width: 760px) {
            .admin-main {
              padding: 0.85rem;
              gap: 0.85rem;
            }

            .admin-hero,
            .admin-card {
              border-radius: 16px;
            }

            .admin-hero,
            .admin-card {
              padding: 0.9rem;
            }

            .admin-hero-copy {
              min-width: 0;
            }

            .admin-hero-meta {
              width: 100%;
            }

            .meta-chip {
              width: 100%;
              justify-content: center;
            }

            .admin-card-header {
              flex-direction: column;
              align-items: stretch;
            }

            .admin-card-header .ghost-btn {
              width: 100%;
              justify-content: center;
            }

            .admin-tabs {
              justify-content: stretch;
              border-radius: 18px;
            }

            .admin-tab {
              flex: 1 0 auto;
              justify-content: center;
            }

            .form-grid {
              grid-template-columns: 1fr;
            }

            .form-actions,
            .row-actions {
              flex-direction: column;
            }

            .primary-btn,
            .ghost-btn,
            .mini-btn {
              width: 100%;
              justify-content: center;
            }

            .admin-table {
              font-size: 0.85rem;
            }

            .admin-table th,
            .admin-table td {
              padding: 0.6rem 0.55rem;
            }

            .key-cell {
              max-width: 180px;
            }
          }

          @media (max-width: 520px) {
            .admin-summary-grid {
              grid-template-columns: 1fr;
            }

            .quick-actions-grid {
              grid-template-columns: 1fr;
            }

            .admin-main {
              padding: 0.75rem;
            }

            .admin-hero,
            .admin-card {
              padding: 0.8rem;
            }

            .hero-title {
              font-size: 1.45rem;
            }

            .admin-banner {
              padding: 0.75rem 0.85rem;
            }

            .admin-table-wrap {
              margin: 0 -0.2rem;
            }
          }
        `}</style>
      </div>
    </AuthGuard>
  );
}
