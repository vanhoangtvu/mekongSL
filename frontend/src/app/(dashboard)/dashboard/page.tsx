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
  updateAdminUser,
  type AdminRole,
  type AdminUser,
  type AdminUserForm,
  type GisLayer,
  type LayerFolderDto,
} from "../../../lib/admin-api";
import NewsManager from "../../../components/admin/NewsManager";
import S3Manager from "../../../components/admin/S3Manager";
import LanduseComputePanel from "../../../components/admin/LanduseComputePanel";
import { DATA_SOURCE_OPTIONS, type DataSourceKey, type EcowittDevice } from "../../../lib/constants/data-sources";
import { collectRecordKeys, formatRecordValue, type DataRecord } from "../../../lib/utils/record-utils";
import {
  Activity, Database, Download, FolderOpen, Folder, FolderPlus, File,
  Newspaper, RefreshCw, Upload, Search, Server, Shield, Users,
} from "lucide-react";

const EMPTY_USER_FORM: AdminUserForm = {
  username: "", email: "", password: "", role: "DATA_MANAGER", enabled: true,
};

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "storage" | "data" | "gis" | "news">("overview");
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
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
  const [s3Unlocked, setS3Unlocked] = useState(false);
  const [showS3Password, setShowS3Password] = useState(false);
  const [s3Password, setS3Password] = useState("");
  const [s3PasswordError, setS3PasswordError] = useState(false);
  const dataColumns = useMemo(() => collectRecordKeys(dataRows).slice(0, 8), [dataRows]);
  const previewRows = useMemo(() => dataRows.slice(0, 10), [dataRows]);
  const selectedTimeframe = useMemo(
    () => timeframes.find((tf) => tf.fetch_run_id === selectedRunId) || null,
    [selectedRunId, timeframes],
  );

  const pushMessage = (text: string, kind: "success" | "error" | "info" = "info") => {
    setMessage(text); setMessageKind(kind);
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    try { setUsers(await listAdminUsers()); }
    catch (error) { pushMessage(error instanceof Error ? error.message : "Không tải được danh sách user", "error"); }
    finally { setUsersLoading(false); }
  };

  const loadS3Files = async () => {};

  const loadData = useCallback(
    async (runId?: string) => {
      if (!runId) { setDataRows([]); return; }
      setDataLoading(true);
      try { setDataRows(await loadDataRows(dataSource, dataDate || undefined, runId, deviceId || undefined)); }
      catch (error) { pushMessage(error instanceof Error ? error.message : "Không tải được dữ liệu", "error"); setDataRows([]); }
      finally { setDataLoading(false); }
    },
    [dataDate, dataSource, deviceId],
  );

  const loadSourceFilesData = async () => {
    setSourceFilesLoading(true);
    try { setSourceFiles(await listSourceFiles(dataSource)); }
    catch (error) { pushMessage(error instanceof Error ? error.message : "Không tải được file nguồn", "error"); setSourceFiles([]); }
    finally { setSourceFilesLoading(false); }
  };

  const loadMonthlyFilesData = async () => {
    setMonthlyLoading(true);
    try { setMonthlyFiles(await listMonthlyExportFiles()); }
    catch (error) { pushMessage(error instanceof Error ? error.message : "Không tải được file Excel tháng", "error"); setMonthlyFiles([]); }
    finally { setMonthlyLoading(false); }
  };

  const loadAccount = async () => {
    try { const account = await loadCurrentAccount(); setCurrentUser(account); }
    catch { authService.logout(); router.replace("/auth"); }
  };

  const loadLayers = async () => {
    try { setLayers(await listGisLayers()); }
    catch { setLayers([]); }
  };

  const loadFolderTree = async (layerId: number) => {
    try { setFolderTree(await listLayerFolderTree(layerId)); }
    catch { setFolderTree([]); }
  };

  useEffect(() => {
    if (selectedLayerId) void loadFolderTree(selectedLayerId);
    else setFolderTree([]);
  }, [selectedLayerId]);

  const refreshAll = async () => {
    await Promise.all([loadAccount(), loadUsers(), loadS3Files(), loadData(), loadSourceFilesData(), loadMonthlyFilesData(), loadLayers()]);
  };

  useEffect(() => { void refreshAll(); }, []);

  useEffect(() => {
    if (!dataDate) { setTimeframes([]); setSelectedRunId(""); setDataRows([]); return; }
    const fetchTimeframes = async () => {
      setTimeframesLoading(true); setSelectedRunId(""); setDataRows([]);
      try {
        const fetched = await loadDataTimeframes(dataSource, dataDate, deviceId || undefined);
        setTimeframes(fetched);
        setSelectedRunId((cur) => fetched.some((tf) => tf.fetch_run_id === cur) ? cur : "");
      } catch (error) {
        pushMessage(error instanceof Error ? error.message : "Không tải được khung giờ", "error");
        setTimeframes([]); setSelectedRunId("");
      } finally { setTimeframesLoading(false); }
    };
    void fetchTimeframes();
  }, [dataDate, dataSource, deviceId]);

  useEffect(() => {
    void loadData(selectedRunId);
    if (dataSource === "ecowitt") {
      const loadFromApi = async () => {
        try {
          const res = await fetch('/api/ecowitt/devices');
          const data = await res.json();
          if (data.devices?.length) { setEcowittDevices(data.devices); return; }
        } catch {}
        try {
          const devices = await loadDataDevices("ecowitt");
          if (devices.length > 0) setEcowittDevices(devices.map((d) => ({ id: d.device_id, name: `Trạm ${d.device_id}` })));
        } catch {}
      };
      loadFromApi();
    }
  }, [loadData, selectedRunId]);

  const handleUserSubmit = async (event: React.FormEvent) => {
    event.preventDefault(); setUserSaving(true);
    try {
      if (editingUserId) { await updateAdminUser(editingUserId, userForm); pushMessage("Đã cập nhật user", "success"); }
      else { await createAdminUser(userForm); pushMessage("Đã tạo user mới", "success"); }
      setEditingUserId(null); setUserForm(EMPTY_USER_FORM); await loadUsers();
    } catch (error) { pushMessage(error instanceof Error ? error.message : "Lưu user thất bại", "error"); }
    finally { setUserSaving(false); }
  };

  const startEditUser = (user: AdminUser) => {
    setEditingUserId(user.id);
    setUserForm({ username: user.username, email: user.email, password: "", role: user.role, enabled: user.enabled });
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`Xóa user ${user.username}?`)) return;
    setBusyAction(`delete-user-${user.id}`);
    try { await deleteAdminUser(user.id); pushMessage("Đã xóa user", "success"); await loadUsers(); }
    catch (error) { pushMessage(error instanceof Error ? error.message : "Xóa user thất bại", "error"); }
    finally { setBusyAction(null); }
  };

  const handleUnifiedUpload = async () => {
    if (!uploadFile) { pushMessage("Chọn file để upload", "error"); return; }
    if (!selectedLayerId) { pushMessage("Chọn Layer để upload file bản đồ", "error"); return; }
    setBusyAction("upload-unified");
    try {
      await uploadLayerFile(selectedLayerId, uploadFile, selectedFolderId || undefined, uploadCategory);
      pushMessage("Đã upload thành công", "success"); setUploadFile(null); await loadS3Files();
    } catch (error) { pushMessage(error instanceof Error ? error.message : "Upload thất bại", "error"); }
    finally { setBusyAction(null); }
  };

  const handleCreateFolder = async () => {
    if (!selectedLayerId) return;
    const name = window.prompt("Nhập tên thư mục mới:");
    if (!name) return;
    try { await createLayerFolder(selectedLayerId, name, selectedFolderId || undefined); pushMessage("Đã tạo thư mục", "success"); await loadFolderTree(selectedLayerId); }
    catch (error) { pushMessage(error instanceof Error ? error.message : "Tạo thư mục thất bại", "error"); }
  };

  const handleDeleteFolder = async (folderId: number) => {
    if (!confirm("Xóa thư mục này?")) return;
    try { await deleteLayerFolder(folderId); pushMessage("Đã xóa thư mục", "success"); if (selectedFolderId === folderId) setSelectedFolderId(null); if (selectedLayerId) await loadFolderTree(selectedLayerId); }
    catch (error) { pushMessage(error instanceof Error ? error.message : "Xóa thư mục thất bại", "error"); }
  };

  const handleS3PasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (s3Password === "4444") {
      setS3Unlocked(true);
      setShowS3Password(false);
      setS3Password("");
      setActiveTab("storage");
    } else {
      setS3PasswordError(true);
    }
  };

  const handleFetchData = async () => {
    setBusyAction("fetch-data");
    try { const result = await triggerDataFetch(dataSource); pushMessage(result.message, "success"); await Promise.all([selectedRunId ? loadData(selectedRunId) : loadData(), loadSourceFilesData(), loadMonthlyFilesData()]); }
    catch (error) { pushMessage(error instanceof Error ? error.message : "Lấy dữ liệu thất bại", "error"); }
    finally { setBusyAction(null); }
  };

  const handleRefreshMonthly = async () => {
    setBusyAction("refresh-monthly");
    try { const result = await refreshMonthlyExport(); pushMessage(result.message, "success"); await loadMonthlyFilesData(); }
    catch (error) { pushMessage(error instanceof Error ? error.message : "Cập nhật Excel thất bại", "error"); }
    finally { setBusyAction(null); }
  };

  const handleExportMonthly = async () => {
    setBusyAction("export-monthly");
    try { await exportMonthlyXlsx(monthlyYear, monthlyMonth, monthlyMetric); pushMessage("Đã xuất file Excel", "success"); await loadMonthlyFilesData(); }
    catch (error) { pushMessage(error instanceof Error ? error.message : "Xuất Excel thất bại", "error"); }
    finally { setBusyAction(null); }
  };

  const tabs = [
    { key: "overview" as const, label: "Tổng quan", icon: Activity, count: null as number | null },
    { key: "users" as const, label: "Người dùng", icon: Users, count: users.length },
    { key: "news" as const, label: "Tin tức", icon: Newspaper, count: null as number | null },
    { key: "storage" as const, label: "S3", icon: Server, count: null },
    { key: "gis" as const, label: "GIS", icon: FolderOpen, count: layers.length },
    { key: "data" as const, label: "Dữ liệu", icon: Database, count: dataRows.length },
  ];

  const roleColor = (role: string) => {
    if (role === "ADMIN") return "var(--r-admin)";
    if (role === "DATA_MANAGER") return "var(--r-manager)";
    return "var(--r-user)";
  };

  return (
    <AuthGuard requiredRole="ADMIN">
      <div className="d-shell">
        <AppHeader />
        <div className="d-layout">
          <aside className="d-sidebar">
            <div className="d-sidebar-user">
              <div className="d-avatar">{currentUser?.username?.charAt(0).toUpperCase() || "A"}</div>
              <div className="d-sidebar-user-info">
                <strong>{currentUser?.username || "Admin"}</strong>
                <span className="d-role-badge" style={{ background: `${roleColor(currentUser?.role || "ADMIN")}15`, color: roleColor(currentUser?.role || "ADMIN") }}>
                  {currentUser?.role || "ADMIN"}
                </span>
              </div>
            </div>
            <nav className="d-nav">
              <div className="d-nav-label">Chức năng chính</div>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.key} type="button" className={`d-nav-item${activeTab === tab.key ? " active" : ""}`} onClick={() => { if (tab.key === "storage" && !s3Unlocked) { setShowS3Password(true); setS3Password(""); setS3PasswordError(false); } else setActiveTab(tab.key); }}>
                    <Icon size={18} />
                    <span>{tab.label}</span>
                    {tab.count !== null && <span className="d-nav-badge">{tab.count}</span>}
                  </button>
                );
              })}
            </nav>
            <div className="d-sidebar-footer">
              <div className="d-status-wrap">
                <span className="d-sidebar-status" />
                <span>Hệ thống trực tuyến</span>
              </div>
              <div className="d-version">v1.2.0</div>
            </div>
          </aside>

          <main className="d-main">
            <div className="d-topbar">
              <div className="d-topbar-left">
                <div className="d-breadcrumb">Quản trị / {tabs.find((t) => t.key === activeTab)?.label}</div>
                <h1 className="d-topbar-title">
                  {tabs.find((t) => t.key === activeTab)?.label || "Dashboard"}
                </h1>
              </div>
              <div className="d-topbar-actions">
                <button className="d-btn d-btn-ghost" onClick={refreshAll} type="button">
                  <RefreshCw size={15} /> Làm mới
                </button>
                {message && (
                  <div className={`d-toast d-toast-${messageKind}`}>
                    {message}
                  </div>
                )}
              </div>
            </div>

            <div className="d-content">
              {activeTab === "overview" && (
                <>
                  <div className="d-stats">
                    <div className="d-stat">
                      <div className="d-stat-icon" style={{ background: "rgba(37,99,168,0.1)", color: "var(--accent)" }}><Users size={22} /></div>
                      <div className="d-stat-info"><span>Người dùng</span><strong>{users.length}</strong></div>
                      <div className="d-stat-trend up">+2 mới</div>
                    </div>
                    <div className="d-stat">
                      <div className="d-stat-icon" style={{ background: "rgba(37,99,168,0.1)", color: "var(--accent)" }}><Newspaper size={22} /></div>
                      <div className="d-stat-info"><span>Bài viết</span><strong>—</strong></div>
                      <div className="d-stat-trend">Cập nhật</div>
                    </div>
                    <div className="d-stat">
                      <div className="d-stat-icon" style={{ background: "rgba(16,185,129,0.1)", color: "var(--success)" }}><Database size={22} /></div>
                      <div className="d-stat-info"><span>Dữ liệu</span><strong>{dataRows.length}</strong></div>
                      <div className="d-stat-trend up">Live</div>
                    </div>
                    <div className="d-stat">
                      <div className="d-stat-icon" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}><FolderOpen size={22} /></div>
                      <div className="d-stat-info"><span>Layers</span><strong>{layers.length}</strong></div>
                      <div className="d-stat-trend">GIS</div>
                    </div>
                  </div>

                  <div className="d-grid-2-1">
                    <div className="d-card">
                      <div className="d-card-h">
                        <h3>Lối tắt nhanh</h3>
                        <p className="d-card-sub">Truy cập nhanh các phân hệ quản trị</p>
                      </div>
                      <div className="d-grid-2">
                        {[
                          { key: "users" as const, icon: Users, label: "Người dùng", desc: "Quản lý tài khoản & phân quyền", color: "#6366f1" },
                          { key: "news" as const, icon: Newspaper, label: "News", desc: "Post articles & new events", color: "#3b82f6" },
                          { key: "storage" as const, icon: Server, label: "S3 Storage", desc: "Quản lý tệp tin trực tuyến", color: "#10b981" },
                          { key: "gis" as const, icon: FolderOpen, label: "GIS Layers", desc: "Cấu trúc bản đồ & dữ liệu", color: "#f59e0b" },
                          { key: "data" as const, icon: Database, label: "Dữ liệu", desc: "Đồng bộ hóa & xuất báo cáo", color: "#ec4899" },
                        ].map((item) => {
                          const Icon = item.icon;
                          return (
                            <button key={item.key} type="button" className="d-quick" onClick={() => { if (item.key === "storage" && !s3Unlocked) { setShowS3Password(true); setS3Password(""); setS3PasswordError(false); } else setActiveTab(item.key); }}>
                              <div className="d-quick-icon" style={{ background: `${item.color}12`, color: item.color }}><Icon size={20} /></div>
                              <div><strong>{item.label}</strong><em>{item.desc}</em></div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="d-card">
                      <div className="d-card-h">
                        <h3>Trạng thái hệ thống</h3>
                      </div>
                      <div className="d-sys-status">
                        <div className="d-sys-item">
                          <span>Backend API</span>
                          <span className="d-sys-dot green">Online</span>
                        </div>
                        <div className="d-sys-item">
                          <span>Database (MySQL)</span>
                          <span className="d-sys-dot green">Connected</span>
                        </div>
                        <div className="d-sys-item">
                          <span>S3 Storage</span>
                          <span className="d-sys-dot green">Healthy</span>
                        </div>
                        <div className="d-sys-item">
                          <span>Mekong API Fetcher</span>
                          <span className="d-sys-dot green">Idle</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "users" && (
                <div className="d-card">
                  <div className="d-card-h">
                    <h3>Người dùng</h3>
                    <button className="d-btn d-btn-ghost" onClick={loadUsers} disabled={usersLoading}><RefreshCw size={15} /> Làm mới</button>
                  </div>
                  <form className="d-form" onSubmit={handleUserSubmit}>
                    <div className="d-form-grid">
                      <label>Tên đăng nhập<input value={userForm.username} onChange={(e) => setUserForm((p) => ({ ...p, username: e.target.value }))} required minLength={3} /></label>
                      <label>Email<input type="email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} required /></label>
                      <label>Mật khẩu {editingUserId ? "(để trống nếu giữ nguyên)" : ""}<input type="password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} minLength={editingUserId ? 0 : 6} required={!editingUserId} /></label>
                      <label>Role<select value={userForm.role} onChange={(e) => setUserForm((p) => ({ ...p, role: e.target.value as AdminRole }))}><option value="USER">USER</option><option value="DATA_MANAGER">DATA_MANAGER</option><option value="ADMIN">ADMIN</option></select></label>
                      <label className="d-checkbox"><input type="checkbox" checked={userForm.enabled} onChange={(e) => setUserForm((p) => ({ ...p, enabled: e.target.checked }))} /> Enabled</label>
                    </div>
                    <div className="d-form-actions">
                      <button className="d-btn d-btn-primary" type="submit" disabled={userSaving}>{userSaving ? "Đang lưu..." : editingUserId ? "Cập nhật user" : "Tạo user"}</button>
                      {editingUserId && <button className="d-btn d-btn-ghost" type="button" onClick={() => { setEditingUserId(null); setUserForm(EMPTY_USER_FORM); }}>Hủy sửa</button>}
                    </div>
                  </form>
                  <div className="d-table-wrap">
                    {usersLoading ? <p className="d-muted">Đang tải...</p> : (
                      <table className="d-table">
                        <thead><tr><th>User</th><th>Role</th><th>Trạng thái</th><th></th></tr></thead>
                        <tbody>{users.map((u) => (
                          <tr key={u.id}>
                            <td><strong>{u.username}</strong><div className="d-subtle">{u.email}</div></td>
                            <td><span className="d-badge" style={{ background: `${roleColor(u.role)}15`, color: roleColor(u.role) }}>{u.role}</span></td>
                            <td><span className={`d-dot ${u.enabled ? "green" : "gray"}`} />{u.enabled ? "Hoạt động" : "Vô hiệu"}</td>
                            <td className="d-actions"><button className="d-btn d-btn-xs" onClick={() => startEditUser(u)}>Sửa</button><button className="d-btn d-btn-xs d-btn-danger" onClick={() => handleDeleteUser(u)} disabled={busyAction === `delete-user-${u.id}`}>Xóa</button></td>
                          </tr>
                        ))}</tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "storage" && (
                <div className="d-card d-card-flush"><S3Manager /></div>
              )}

              {activeTab === "gis" && (
                <>
                  <div className="d-split">
                    <div className="d-card">
                      <div className="d-card-h"><h3>Thư mục Layer</h3></div>
                      <div className="d-form-group"><label>Chọn Layer</label><select value={selectedLayerId || ""} onChange={(e) => setSelectedLayerId(Number(e.target.value) || null)} style={{ border: !selectedLayerId ? "2px solid #6366f1" : undefined }}><option value="">-- Chọn Layer --</option>{layers.map((l) => <option key={l.id} value={l.id}>{l.layerName}</option>)}</select></div>
                      <div style={{ marginTop: 16, minHeight: 200 }}>
                        {!selectedLayerId ? (
                          <div className="d-empty"><Folder size={36} /><p>Chọn một Layer để quản lý thư mục</p></div>
                        ) : (
                          <><div className={`d-folder ${selectedFolderId === null ? "active" : ""}`} onClick={() => setSelectedFolderId(null)}><Folder size={16} /> <span>Root</span></div>
                          <div style={{ marginLeft: 14 }}>{folderTree.map((f) => (
                            <div key={f.id} className={`d-folder ${selectedFolderId === f.id ? "active" : ""}`} onClick={() => setSelectedFolderId(f.id)}>
                              <Folder size={16} /> <span>{f.name}</span>
                              <button className="d-btn d-btn-xs d-btn-danger" onClick={(e) => { e.stopPropagation(); handleDeleteFolder(f.id); }}>x</button>
                            </div>
                          ))}</div>
                          <button className="d-btn d-btn-ghost" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} onClick={handleCreateFolder}><FolderPlus size={16} /> Tạo thư mục</button></>
                        )}
                      </div>
                    </div>
                    <div className="d-card">
                      <div className="d-card-h"><h3>Upload file</h3></div>
                      {!selectedLayerId ? <div className="d-empty"><p>Chọn Layer trước</p></div> : (
                        <><div className="d-upload-box">
                          <div className="d-form-group"><label>File (.tif, .zip...)</label><input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} /></div>
                          <div className="d-form-group"><label>Loại</label><select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}><option value="default">Mặc định</option><option value="raster">Raster</option><option value="vector">Vector</option><option value="document">Tài liệu</option><option value="backup">Backup</option></select></div>
                          <button className="d-btn d-btn-primary" onClick={handleUnifiedUpload} disabled={busyAction === "upload-unified" || !uploadFile}><Upload size={16} /> Upload</button>
                        </div>
                        <p className="d-note">Path S3 tự động sinh theo cấu trúc thư mục đã chọn.</p>
                        <div className="d-empty">File trong thư mục sẽ hiển thị tại đây</div></>
                      )}
                    </div>
                  </div>
                  <LanduseComputePanel />
                </>
              )}

              {activeTab === "data" && (
                <div className="d-split">
                  <div className="d-card">
                    <div className="d-card-h"><h3>Đồng bộ dữ liệu</h3><button className="d-btn d-btn-ghost" onClick={() => loadData(selectedRunId)} disabled={dataLoading || !selectedRunId}><RefreshCw size={15} /> Tải lại</button></div>
                    <div className="d-form">
                      <div className="d-form-grid">
                        <label>Nguồn<select value={dataSource} onChange={(e) => setDataSource(e.target.value as DataSourceKey)}>{DATA_SOURCE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label>
                        {dataSource === "ecowitt" && <label>Thiết bị<select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}><option value="">Tất cả</option>{ecowittDevices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
                        <label>Ngày<input type="date" value={dataDate} onChange={(e) => setDataDate(e.target.value)} /></label>
                        <label>Khung giờ<select value={selectedRunId} onChange={(e) => setSelectedRunId(e.target.value)} disabled={timeframesLoading || !dataDate}><option value="">Chọn khung giờ</option>{timeframesLoading ? <option>Đang tải...</option> : timeframes.map((tf) => <option key={tf.fetch_run_id} value={tf.fetch_run_id}>{new Date(tf.fetched_at).toLocaleTimeString("vi-VN")}</option>)}</select></label>
                      </div>
                      <div className="d-chip-group">
                        <span className="d-muted">{dataDate ? `${timeframes.length} khung giờ` : "Chọn ngày"}</span>
                        {selectedTimeframe && <span className="d-chip active">Đang xem {new Date(selectedTimeframe.fetched_at).toLocaleTimeString("vi-VN")}</span>}
                        <div className="d-chip-list">{timeframes.map((tf) => (
                          <button key={tf.fetch_run_id} type="button" className={`d-chip${selectedRunId === tf.fetch_run_id ? " active" : ""}`} onClick={() => setSelectedRunId(tf.fetch_run_id)} disabled={timeframesLoading}>
                            {new Date(tf.fetched_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                          </button>
                        ))}</div>
                      </div>
                      <div className="d-form-actions">
                        <button className="d-btn d-btn-primary" onClick={handleFetchData} disabled={busyAction === "fetch-data"}><Database size={16} /> Chạy đồng bộ</button>
                        <button className="d-btn d-btn-ghost" onClick={() => loadData(selectedRunId)} disabled={dataLoading || !selectedRunId}><Search size={16} /> Tải lại</button>
                      </div>
                    </div>
                    <div className="d-table-wrap" style={{ marginTop: 16 }}>
                      {dataLoading ? <p className="d-muted">Đang tải...</p> : previewRows.length === 0 ? <p className="d-muted">{selectedRunId ? "Chưa có dữ liệu" : "Chọn khung giờ"}</p> : (
                        <table className="d-table"><thead><tr>{dataColumns.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{previewRows.map((row, i) => <tr key={i}>{dataColumns.map((c) => <td key={c}>{formatRecordValue(row[c])}</td>)}</tr>)}</tbody></table>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="d-card">
                      <div className="d-card-h"><h3>Excel tháng</h3><button className="d-btn d-btn-ghost" onClick={loadMonthlyFilesData} disabled={monthlyLoading}><RefreshCw size={15} /> Làm mới</button></div>
                      <div className="d-form">
                        <div className="d-form-grid">
                          <label>Năm<input type="number" value={monthlyYear} onChange={(e) => setMonthlyYear(Number(e.target.value))} /></label>
                          <label>Tháng<input type="number" min={1} max={12} value={monthlyMonth} onChange={(e) => setMonthlyMonth(Number(e.target.value))} /></label>
                          <label>Chỉ số<select value={monthlyMetric} onChange={(e) => setMonthlyMetric(e.target.value)}><option value="salinity">salinity</option><option value="ph">pH</option><option value="waterlevel">waterlevel</option></select></label>
                        </div>
                        <div className="d-form-actions"><button className="d-btn d-btn-primary" onClick={handleExportMonthly} disabled={busyAction === "export-monthly"}><Download size={16} /> Xuất file</button><button className="d-btn d-btn-ghost" onClick={handleRefreshMonthly} disabled={busyAction === "refresh-monthly"}><RefreshCw size={16} /> Cập nhật</button></div>
                      </div>
                      <div className="d-table-wrap">{monthlyLoading ? <p className="d-muted">Đang tải...</p> : (
                        <table className="d-table"><thead><tr><th>File</th><th>Kích thước</th><th>Cập nhật</th></tr></thead><tbody>{monthlyFiles.map((f) => <tr key={f.name}><td className="d-key">{f.name}</td><td>{formatSize(f.size)}</td><td>{formatDate(f.modifiedAt)}</td></tr>)}</tbody></table>
                      )}</div>
                    </div>
                    <div className="d-card" style={{ marginTop: 16 }}>
                      <div className="d-card-h"><h3>Snapshot dữ liệu</h3><button className="d-btn d-btn-ghost" onClick={loadSourceFilesData} disabled={sourceFilesLoading}><RefreshCw size={15} /> Làm mới</button></div>
                      <div className="d-table-wrap">{sourceFilesLoading ? <p className="d-muted">Đang tải...</p> : (
                        <table className="d-table"><thead><tr><th>Tên file</th><th>Kích thước</th><th>Cập nhật</th></tr></thead><tbody>{sourceFiles.map((f) => <tr key={f.name}><td className="d-key">{f.name}</td><td>{formatSize(f.size)}</td><td>{formatDate(f.modifiedAt)}</td></tr>)}</tbody></table>
                      )}</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "news" && <NewsManager />}
            </div>
          </main>
        </div>
        <AppFooter />

        {showS3Password && (
          <div className="d-overlay" onClick={() => setShowS3Password(false)}>
            <div className="d-modal" onClick={(e) => e.stopPropagation()}>
              <div className="d-modal-header">
                <Server size={22} />
                <h2>Xác thực truy cập S3</h2>
              </div>
              <p className="d-modal-desc">Nhập mật khẩu để truy cập vào tab quản lý S3 Storage</p>
              <form onSubmit={handleS3PasswordSubmit}>
                <input
                  type="password"
                  className={`d-modal-input${s3PasswordError ? " error" : ""}`}
                  placeholder="Nhập mật khẩu..."
                  value={s3Password}
                  onChange={(e) => { setS3Password(e.target.value); setS3PasswordError(false); }}
                  autoFocus
                />
                {s3PasswordError && <p className="d-modal-error">Mật khẩu không đúng, vui lòng thử lại!</p>}
                <div className="d-modal-actions">
                  <button type="button" className="d-btn d-btn-ghost" onClick={() => setShowS3Password(false)}>Hủy</button>
                  <button type="submit" className="d-btn d-btn-primary">Xác nhận</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .d-shell { display: flex; flex-direction: column; height: 100dvh; background: #f4f7fa; color: #334155; }
        .d-layout { display: flex; flex: 1; min-height: 0; }

        /* ── Sidebar ── */
        .d-sidebar {
          width: 260px; flex-shrink: 0;
          background: #ffffff;
          border-right: 1px solid #e2e8f0;
          display: flex; flex-direction: column;
          padding: 1.25rem 1rem;
          gap: 0.5rem;
          box-shadow: 4px 0 10px rgba(0,0,0,0.02);
          z-index: 20;
        }
        .d-sidebar-user {
          display: flex; align-items: center; gap: 0.85rem;
          padding: 0.85rem; margin-bottom: 1.25rem;
          background: #f8fafc; border-radius: 14px;
          border: 1px solid #f1f5f9;
        }
        .d-avatar {
          width: 44px; height: 44px; border-radius: 12px;
          background: linear-gradient(135deg, #2563a8, #3b82f6);
          color: #fff; display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 1.2rem; flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(37, 99, 168, 0.2);
        }
        .d-sidebar-user-info strong { display: block; font-size: 0.95rem; color: #0f172a; }
        .d-role-badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 6px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em; margin-top: 2px; }
        
        .d-nav { display: flex; flex-direction: column; gap: 0.35rem; flex: 1; }
        .d-nav-label { font-size: 0.68rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; padding: 0 0.85rem 0.5rem; }
        .d-nav-item {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.75rem 0.85rem;
          border: none; border-radius: 12px;
          background: transparent; color: #64748b;
          font-size: 0.92rem; font-weight: 500;
          cursor: pointer; text-align: left;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .d-nav-item:hover { background: #f1f5f9; color: #2563a8; }
        .d-nav-item.active { background: #eff6ff; color: #2563a8; font-weight: 600; box-shadow: inset 0 0 0 1px rgba(37, 99, 168, 0.1); }
        .d-nav-badge {
          margin-left: auto; padding: 0.15rem 0.5rem;
          border-radius: 999px; background: #f1f5f9; color: #64748b;
          font-size: 0.7rem; font-weight: 700;
        }
        .d-nav-item.active .d-nav-badge { background: #dbeafe; color: #2563a8; }
        
        .d-sidebar-footer {
          display: flex; flex-direction: column; gap: 0.5rem;
          padding: 1rem 0.85rem 0.5rem; border-top: 1px solid #f1f5f9;
        }
        .d-status-wrap { display: flex; align-items: center; gap: 0.5rem; font-size: 0.78rem; color: #64748b; font-weight: 500; }
        .d-sidebar-status { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15); }
        .d-version { font-size: 0.72rem; color: #cbd5e1; font-weight: 600; }

        /* ── Main ── */
        .d-main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: auto; }
        .d-topbar {
          display: flex; align-items: center; justify-content: space-between; gap: 1.5rem;
          padding: 1.25rem 2rem; background: #fff; border-bottom: 1px solid #e2e8f0;
          position: sticky; top: 0; z-index: 15;
        }
        .d-topbar-left { display: flex; flex-direction: column; gap: 2px; }
        .d-breadcrumb { font-size: 0.75rem; color: #94a3b8; font-weight: 500; }
        .d-topbar-title { font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0; letter-spacing: -0.01em; }
        .d-topbar-actions { display: flex; align-items: center; gap: 1rem; }
        .d-content { padding: 2rem; display: grid; gap: 1.5rem; flex: 1; max-width: 1400px; }

        /* ── Stats ── */
        .d-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.25rem; }
        .d-stat {
          position: relative; display: flex; align-items: center; gap: 1.15rem;
          padding: 1.5rem; background: #fff; border-radius: 20px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .d-stat:hover { box-shadow: 0 10px 25px rgba(0,0,0,0.04); transform: translateY(-3px); border-color: #e2e8f0; }
        .d-stat-icon {
          width: 52px; height: 52px; border-radius: 16px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .d-stat-info span { display: block; font-size: 0.78rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .d-stat-info strong { font-size: 1.75rem; font-weight: 800; color: #0f172a; line-height: 1.1; }
        .d-stat-trend { position: absolute; top: 1rem; right: 1.25rem; font-size: 0.68rem; font-weight: 700; color: #94a3b8; }
        .d-stat-trend.up { color: #10b981; }

        /* ── Card ── */
        .d-card { background: #fff; border-radius: 20px; padding: 1.5rem; border: 1px solid #f1f5f9; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
        .d-card-sub { font-size: 0.85rem; color: #94a3b8; margin: 0.15rem 0 0; font-weight: 500; }
        .d-card-flush { padding: 0; overflow: hidden; }
        .d-card-h { display: flex; flex-direction: column; margin-bottom: 1.5rem; }
        .d-card-h h3 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #0f172a; }

        /* ── Grids ── */
        .d-grid-2-1 { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; }
        .d-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .d-split { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start; }

        /* ── Quick actions ── */
        .d-quick {
          display: flex; align-items: center; gap: 1rem;
          padding: 1.15rem; border: 1px solid #f1f5f9; border-radius: 16px;
          background: #ffffff; cursor: pointer; text-align: left;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .d-quick:hover { border-color: #2563a8; background: #fff; box-shadow: 0 10px 20px rgba(37, 99, 168, 0.05); transform: translateY(-2px); }
        .d-quick-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .d-quick div { display: grid; gap: 0.15rem; }
        .d-quick strong { font-size: 0.95rem; font-weight: 700; color: #1e293b; }
        .d-quick em { font-style: normal; font-size: 0.78rem; color: #64748b; font-weight: 500; }

        /* ── System Status ── */
        .d-sys-status { display: flex; flex-direction: column; gap: 0.75rem; }
        .d-sys-item { display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1rem; background: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9; font-size: 0.88rem; font-weight: 600; color: #475569; }
        .d-sys-dot { display: flex; align-items: center; gap: 0.5rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; }
        .d-sys-dot::before { content: ""; width: 6px; height: 6px; border-radius: 50%; }
        .d-sys-dot.green { color: #10b981; }
        .d-sys-dot.green::before { background: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15); }

        /* ── Form ── */
        .d-form {
          margin-bottom: 1.5rem;
          padding: 1.5rem; background: #f8fafc; border-radius: 16px; border: 1px solid #f1f5f9;
        }
        .d-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.5rem; }
        .d-form-grid label { display: grid; gap: 0.5rem; font-size: 0.88rem; font-weight: 600; color: #475569; }
        .d-form-grid input, .d-form-grid select, .d-form-grid textarea {
          padding: 0.75rem 1rem; border: 1px solid #e2e8f0; border-radius: 12px;
          background: #fff; color: #1e293b; font-size: 0.92rem; font-family: inherit;
          transition: all 0.2s;
        }
        .d-form-grid input:focus, .d-form-grid select:focus, .d-form-grid textarea:focus {
          outline: none; border-color: #2563a8; box-shadow: 0 0 0 4px rgba(37, 99, 168, 0.1);
        }
        .d-checkbox { display: flex !important; flex-direction: row !important; align-items: center !important; gap: 0.75rem !important; font-weight: 600 !important; }
        .d-checkbox input[type="checkbox"] { width: 20px; height: 20px; accent-color: #2563a8; cursor: pointer; }
        .d-form-actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }

        /* ── Buttons ── */
        .d-btn {
          display: inline-flex; align-items: center; gap: 0.5rem;
          padding: 0.7rem 1.25rem; border-radius: 12px; border: 1px solid transparent;
          font-size: 0.9rem; font-weight: 600; cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .d-btn-primary { background: #2563a8; color: #fff; box-shadow: 0 4px 12px rgba(37, 99, 168, 0.2); }
        .d-btn-primary:hover { background: #1e548f; box-shadow: 0 6px 16px rgba(37, 99, 168, 0.3); transform: translateY(-2px); }
        .d-btn-ghost { background: #fff; color: #475569; border: 1px solid #e2e8f0; }
        .d-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; color: #0f172a; }
        .d-btn-xs { padding: 0.4rem 0.85rem; font-size: 0.8rem; background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }
        .d-btn-xs:hover { background: #fff; border-color: #cbd5e1; color: #0f172a; }
        .d-btn-danger { background: #fff5f5; color: #ef4444; border: 1px solid #fee2e2; }
        .d-btn-danger:hover { background: #fee2e2; transform: translateY(-1px); }

        /* ── Table ── */
        .d-table-wrap { overflow: auto; border-radius: 16px; border: 1px solid #f1f5f9; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
        .d-table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
        .d-table thead { background: #f8fafc; position: sticky; top: 0; z-index: 1; }
        .d-table th, .d-table td { padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; text-align: left; vertical-align: middle; }
        .d-table th { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
        .d-table tbody tr:hover { background: #fbfcfd; }
        .d-table tbody tr:last-child td { border-bottom: none; }
        .d-actions { display: flex; gap: 0.5rem; }
        .d-key { max-width: 250px; word-break: break-all; font-weight: 600; color: #334155; }
        .d-muted { color: #94a3b8; font-size: 0.92rem; padding: 1rem 0; font-weight: 500; }
        .d-subtle { color: #94a3b8; font-size: 0.82rem; margin-top: 2px; }
        .d-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.5rem; }
        .d-dot.green { background: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15); }
        .d-dot.gray { background: #cbd5e1; }

        /* ── Toasts ── */
        .d-toast {
          padding: 0.6rem 1.25rem; border-radius: 12px; font-size: 0.88rem; font-weight: 600;
          animation: dSlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        @keyframes dSlideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .d-toast-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
        .d-toast-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .d-toast-info { background: #f8fafc; color: #475569; border: 1px solid #e2e8f0; }

        /* ── Empty & Status ── */
        .d-empty { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 3rem 1.5rem; text-align: center; color: #94a3b8; }
        .d-empty svg { opacity: 0.2; }
        .d-chip-group { display: flex; flex-direction: column; gap: 0.85rem; padding: 1.25rem; background: #fff; border: 1px solid #f1f5f9; border-radius: 16px; }
        .d-chip-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .d-chip {
          padding: 0.45rem 1rem; border: 1px solid #e2e8f0; border-radius: 999px;
          background: #fff; color: #64748b; font-size: 0.84rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .d-chip:hover { border-color: #2563a8; color: #2563a8; background: #eff6ff; }
        .d-chip.active { border-color: #2563a8; background: #2563a8; color: #fff; box-shadow: 0 4px 10px rgba(37, 99, 168, 0.2); }

        /* ── Folders ── */
        .d-folder { display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 0.85rem; border-radius: 10px; cursor: pointer; font-size: 0.9rem; font-weight: 600; color: #475569; transition: all 0.2s; }
        .d-folder:hover { background: #f1f5f9; color: #0f172a; }
        .d-folder.active { background: #eff6ff; color: #2563a8; }
        .d-folder svg { color: #94a3b8; }
        .d-folder.active svg { color: #2563a8; }

        /* ── Variables ── */
        :global(body) { --accent: #2563a8; --success: #10b981; --r-admin: #ef4444; --r-manager: #2563a8; --r-user: #64748b; --r-muted: #94a3b8; }

        @media (max-width: 1200px) {
          .d-stats { grid-template-columns: repeat(2, 1fr); }
          .d-grid-2-1 { grid-template-columns: 1fr; }
        }
        @media (max-width: 768px) {
          .d-sidebar { display: none; }
          .d-topbar { padding: 1rem 1.25rem; }
          .d-content { padding: 1.25rem; }
          .d-stats { grid-template-columns: 1fr; }
          .d-split { grid-template-columns: 1fr; }
        }

        /* ── S3 Password Modal ── */
        .d-overlay {
          position: fixed; inset: 0; z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          animation: dFadeIn 0.2s ease;
        }
        @keyframes dFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .d-modal {
          background: #fff; border-radius: 20px; padding: 2rem;
          width: 100%; max-width: 420px;
          box-shadow: 0 25px 50px rgba(0,0,0,0.15);
          animation: dModalIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes dModalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .d-modal-header {
          display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;
          color: #2563a8;
        }
        .d-modal-header h2 { margin: 0; font-size: 1.2rem; font-weight: 700; color: #0f172a; }
        .d-modal-desc { color: #64748b; font-size: 0.88rem; margin-bottom: 1.5rem; }
        .d-modal-input {
          width: 100%; padding: 0.85rem 1rem; border: 1px solid #e2e8f0;
          border-radius: 12px; font-size: 1rem; font-family: inherit;
          transition: all 0.2s; box-sizing: border-box; margin-bottom: 0.5rem;
        }
        .d-modal-input:focus { outline: none; border-color: #2563a8; box-shadow: 0 0 0 4px rgba(37, 99, 168, 0.1); }
        .d-modal-input.error { border-color: #ef4444; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1); }
        .d-modal-error { color: #ef4444; font-size: 0.82rem; font-weight: 600; margin: 0.25rem 0 1rem; }
        .d-modal-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.25rem; }
      `}</style>
    </AuthGuard>
  );
}
