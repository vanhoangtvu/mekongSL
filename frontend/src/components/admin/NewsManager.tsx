"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listNewsArticles, createNewsArticle, updateNewsArticle, deleteNewsArticle,
  API_URL,
  type NewsArticle, type NewsArticleForm,
} from "../../lib/admin-api";
import { authService } from "../../lib/auth";
import { RefreshCw, Search, Plus, Eye, EyeOff, Sparkles } from "lucide-react";

const NEWS_CATEGORIES = [
  "Cập nhật hệ thống", "Dữ liệu", "Thông báo", "Sự kiện", "Tính năng mới", "Hướng dẫn",
];

const EMPTY_FORM: NewsArticleForm = {
  title: "", slug: "", excerpt: "", content: "", category: "Tin tức",
  imageUrl: "", images: [], tags: "", published: false, featured: false,
};

const SIDEBAR_PANELS = [
  { id: "publish", title: "Xuất bản" },
  { id: "category", title: "Danh mục" },
  { id: "image", title: "Ảnh đại diện" },
  { id: "gallery", title: "Thư viện ảnh" },
  { id: "tags", title: "Thẻ (Tags)" },
] as const;

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("vi-VN");
}

type BlockStyles = {
  color?: string;
  fontSize?: string;
  fontWeight?: string;
  textAlign?: string;
};

type ContentBlock =
  | { id: string; type: "text"; value: string; styles?: BlockStyles }
  | { id: string; type: "heading"; value: string; level: number; styles?: BlockStyles }
  | { id: string; type: "image"; value: string; caption: string; align: string }
  | { id: string; type: "table"; rows: string[][] };

const htmlToBlocks = (html: string): ContentBlock[] => {
  if (!html) return [{ id: Math.random().toString(36).slice(2, 9), type: "text", value: "" }];
  const div = document.createElement("div");
  div.innerHTML = html;
  const blocks: ContentBlock[] = [];

  Array.from(div.childNodes).forEach((node) => {
    const id = Math.random().toString(36).slice(2, 9);
    if (node.nodeType === Node.TEXT_NODE) {
      const val = node.textContent?.trim();
      if (val) blocks.push({ id, type: "text", value: val });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag.startsWith("h") && tag.length === 2) {
        blocks.push({ id, type: "heading", value: el.innerText, level: parseInt(tag[1], 10) });
      } else if (tag === "figure") {
        const img = el.querySelector("img");
        const cap = el.querySelector("figcaption");
        blocks.push({
          id, type: "image",
          value: img?.getAttribute("src") || "",
          caption: cap?.innerText || "",
          align: el.style.textAlign || "center",
        });
      } else if (tag === "img") {
        blocks.push({ id, type: "image", value: el.getAttribute("src") || "", caption: "", align: "center" });
      } else if (tag === "table") {
        const rows: string[][] = [];
        el.querySelectorAll("tr").forEach((tr) => {
          const cells: string[] = [];
          tr.querySelectorAll("th, td").forEach((td) => cells.push(td.innerHTML));
          if (cells.length) rows.push(cells);
        });
        blocks.push({ id, type: "table", rows: rows.length ? rows : [["", ""], ["", ""]] });
      } else {
        blocks.push({ id, type: "text", value: el.outerHTML });
      }
    }
  });
  return blocks.length ? blocks : [{ id: Math.random().toString(36).slice(2, 9), type: "text", value: "" }];
};

const blocksToHtml = (blocks: ContentBlock[]): string => {
  return blocks.map((b) => {
    if (b.type === "heading") return `<h${b.level}>${b.value}</h${b.level}>`;
    if (b.type === "image") {
      if (b.caption) {
        return `<figure style="margin:1.5rem 0;text-align:${b.align}">\n  <img src="${b.value}" alt="${b.caption}" style="max-width:100%;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08)" />\n  <figcaption style="margin-top:0.5rem;font-size:0.85rem;color:#6b7280;font-style:italic;text-align:center">${b.caption}</figcaption>\n</figure>`;
      }
      return `<img src="${b.value}" alt="" style="max-width:100%;border-radius:8px;margin:1rem 0;display:block" />`;
    }
    if (b.type === "table") {
      const rowsHtml = b.rows.map((row, i) => {
        const cells = row.map((cell) => i === 0 ? `<th>${cell}</th>` : `<td>${cell}</td>`).join("");
        return `  <tr${i === 0 ? ' style="background:#f3f4f6"' : ""}>${cells}</tr>`;
      }).join("\n");
      return `<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;margin:1rem 0">\n${rowsHtml}\n</table>`;
    }
    return b.value.includes("<") ? b.value : `<p>${b.value}</p>`;
  }).join("\n");
};

export default function NewsManager() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<NewsArticleForm>(EMPTY_FORM);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [editorMode, setEditorMode] = useState<"block" | "code">("block");
  const [imageUploading, setImageUploading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [msg, setMsg] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [sidebarOrder, setSidebarOrder] = useState(SIDEBAR_PANELS.map((p) => p.id));
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({});
  const [hiddenPanels, setHiddenPanels] = useState<Record<string, boolean>>({});
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showPanelMenu, setShowPanelMenu] = useState(false);
  const panelMenuRef = useRef<HTMLDivElement>(null);

  const [insertDlg, setInsertDlg] = useState<{ url: string; caption: string; align: string } | null>(null);

  useEffect(() => {
    if (!showPanelMenu) return;
    const h = (e: MouseEvent) => { if (panelMenuRef.current && !panelMenuRef.current.contains(e.target as Node)) setShowPanelMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showPanelMenu]);

  const pushMsg = (text: string, kind: "success" | "error") => {
    setMsg({ text, kind });
    setTimeout(() => setMsg(null), 4000);
  };

  const loadArticles = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const r = await listNewsArticles(p, 20);
      setArticles(r.content);
      setPage(r.number);
      setTotalPages(r.totalPages);
      setTotalElements(r.totalElements);
    } catch (e: any) {
      pushMsg(e.message || "Không tải được danh sách", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadArticles(0); }, [loadArticles]);

  const updateFormContent = (newBlocks: ContentBlock[]) => {
    setBlocks(newBlocks);
    setForm((p) => ({ ...p, content: blocksToHtml(newBlocks) }));
  };

  const addBlock = (type: ContentBlock["type"]) => {
    const id = Math.random().toString(36).slice(2, 9);
    let nb: ContentBlock;
    if (type === "text") nb = { id, type, value: "" };
    else if (type === "heading") nb = { id, type, value: "", level: 3 };
    else if (type === "image") nb = { id, type, value: "", caption: "", align: "center" };
    else nb = { id, type, rows: [["Tiêu đề 1", "Tiêu đề 2"], ["Dữ liệu 1", "Dữ liệu 2"]] };
    updateFormContent([...blocks, nb]);
  };

  const addTableRow = (id: string) => {
    const b = blocks.find(x => x.id === id);
    if (b && b.type === "table") {
      const newRow = Array(b.rows[0].length).fill("");
      updateBlock(id, { rows: [...b.rows, newRow] });
    }
  };

  const addTableCol = (id: string) => {
    const b = blocks.find(x => x.id === id);
    if (b && b.type === "table") {
      const newRows = b.rows.map(row => [...row, ""]);
      updateBlock(id, { rows: newRows });
    }
  };

  const removeTableRow = (id: string, idx: number) => {
    const b = blocks.find(x => x.id === id);
    if (b && b.type === "table" && b.rows.length > 1) {
      updateBlock(id, { rows: b.rows.filter((_, i) => i !== idx) });
    }
  };

  const removeTableCol = (id: string, idx: number) => {
    const b = blocks.find(x => x.id === id);
    if (b && b.type === "table" && b.rows[0].length > 1) {
      updateBlock(id, { rows: b.rows.map(row => row.filter((_, i) => i !== idx)) });
    }
  };

  const updateTableCell = (id: string, r: number, c: number, val: string) => {
    const b = blocks.find(x => x.id === id);
    if (b && b.type === "table") {
      const newRows = [...b.rows];
      newRows[r] = [...newRows[r]];
      newRows[r][c] = val;
      updateBlock(id, { rows: newRows });
    }
  };

  const removeBlock = (id: string) => updateFormContent(blocks.filter((b) => b.id !== id));

  const updateBlock = (id: string, patch: Partial<ContentBlock>) => {
    updateFormContent(blocks.map((b) => (b.id === id ? { ...b, ...patch } as ContentBlock : b)));
  };

  const startNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setBlocks([{ id: Math.random().toString(36).slice(2, 9), type: "text", value: "", styles: {} }]);
    setShowForm(true);
  };

  const BlockStyleBar = ({ styles, onUpdate }: { styles: BlockStyles; onUpdate: (s: BlockStyles) => void }) => {
    const colors = ["#000000", "#2563a8", "#10b981", "#ef4444", "#f59e0b", "#6366f1", "#94a3b8"];
    const sizes = [
      { label: "Nhỏ", value: "0.85rem" },
      { label: "Vừa", value: "1rem" },
      { label: "Lớn", value: "1.25rem" },
      { label: "Rất lớn", value: "1.5rem" },
    ];

    return (
      <div className="nm-style-bar">
        <div className="nm-style-group">
          {colors.map((c) => (
            <button key={c} type="button" className={`nm-style-color${styles.color === c ? " active" : ""}`}
              style={{ background: c }} onClick={() => onUpdate({ ...styles, color: styles.color === c ? undefined : c })} />
          ))}
        </div>
        <div className="nm-tb-sep" />
        <select className="nm-block-select" value={styles.fontSize || "1rem"} onChange={(e) => onUpdate({ ...styles, fontSize: e.target.value })}>
          {sizes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button type="button" className={`nm-style-btn${styles.fontWeight === "bold" ? " active" : ""}`}
          onClick={() => onUpdate({ ...styles, fontWeight: styles.fontWeight === "bold" ? "normal" : "bold" })}><b>B</b></button>
        <div className="nm-tb-sep" />
        <div className="nm-style-group">
          {["left", "center", "right", "justify"].map((a) => (
            <button key={a} type="button" className={`nm-style-btn${styles.textAlign === a ? " active" : ""}`}
              onClick={() => onUpdate({ ...styles, textAlign: a })} title={`Căn ${a}`}>
              {a === "left" ? "←" : a === "center" ? "↔" : a === "right" ? "→" : "≡"}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const startEdit = (a: NewsArticle) => {
    setEditingId(a.id);
    const f = {
      title: a.title, slug: a.slug, excerpt: a.excerpt || "", content: a.content || "",
      category: a.category, imageUrl: a.imageUrl || "", images: a.images || [],
      tags: a.tags || "", published: a.published, featured: a.featured,
    };
    setForm(f);
    setBlocks(htmlToBlocks(a.content || ""));
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setBlocks([]);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await updateNewsArticle(editingId, form);
        pushMsg("Đã cập nhật bài viết", "success");
      } else {
        await createNewsArticle(form);
        pushMsg("Đã tạo bài viết mới", "success");
      }
      cancelEdit();
      await loadArticles(0);
    } catch (err: any) {
      pushMsg(err.message || "Lưu thất bại", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a: NewsArticle) => {
    if (!confirm(`Xóa bài viết "${a.title}"?`)) return;
    try {
      await deleteNewsArticle(a.id);
      pushMsg("Đã xóa bài viết", "success");
      await loadArticles(0);
    } catch (err: any) {
      pushMsg(err.message || "Xóa thất bại", "error");
    }
  };

  const uploadImage = async (file: File, isGallery: boolean) => {
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("key", `news-images/${Date.now()}-${file.name}`);
      const res = await fetch(`${API_URL}/s3/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authService.getToken()}` },
        body: fd,
      });
      if (!res.ok) throw new Error("Upload thất bại");
      const data = await res.json();
      if (isGallery) {
        setForm((p) => ({ ...p, images: [...p.images, data.url] }));
      } else {
        setForm((p) => ({ ...p, imageUrl: data.url }));
      }
      pushMsg("Đã upload ảnh", "success");
    } catch (err: any) {
      pushMsg(err.message || "Upload ảnh thất bại", "error");
    } finally {
      setImageUploading(false);
    }
  };

  const removeGalleryImg = (idx: number) => {
    setForm((p) => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));
  };

  const [previewMode, setPreviewMode] = useState(false);

  const wrapSelection = (before: string, after: string) => {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selection = form.content.slice(start, end);
    const newContent = form.content.slice(0, start) + before + selection + after + form.content.slice(end);
    setForm((p) => ({ ...p, content: newContent }));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const insertImageAtCursor = (url: string, caption: string, align: string) => {
    const imgTag = caption
      ? `<figure style="margin:1.5rem 0;text-align:${align}">\n  <img src="${url}" alt="${caption}" style="max-width:100%;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08)" />\n  <figcaption style="margin-top:0.5rem;font-size:0.85rem;color:#6b7280;font-style:italic;text-align:center">${caption}</figcaption>\n</figure>\n`
      : `<img src="${url}" alt="" style="max-width:100%;border-radius:8px;margin:1rem 0;display:block" />\n`;
    setForm((p) => {
      const ta = contentRef.current;
      if (ta) {
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const before = p.content.slice(0, start);
        const after = p.content.slice(end);
        return { ...p, content: before + imgTag + after };
      }
      return { ...p, content: p.content + imgTag };
    });
  };

  const insertTable = () => {
    const table = `\n<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;margin:1rem 0">\n  <tr style="background:#f3f4f6"><th>Cột 1</th><th>Cột 2</th><th>Cột 3</th></tr>\n  <tr><td>Dữ liệu 1</td><td>Dữ liệu 2</td><td>Dữ liệu 3</td></tr>\n  <tr><td>Dữ liệu 4</td><td>Dữ liệu 5</td><td>Dữ liệu 6</td></tr>\n</table>\n`;
    setForm((p) => ({ ...p, content: p.content + table }));
  };

  const autoSlug = (title: string) => {
    const slug = title.toLowerCase().replace(/đ/g, "d").replace(/Đ/g, "D")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    setForm((p) => ({ ...p, slug }));
  };

  const filtered = articles.filter((a) => {
    if (searchText && !a.title.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (catFilter && a.category !== catFilter) return false;
    return true;
  });

  const [showAiComingSoon, setShowAiComingSoon] = useState(false);

  return (
    <div className="nm-shell">
      {msg && <div className={`nm-toast nm-toast-${msg.kind}`}>{msg.text}</div>}
      
      {showAiComingSoon && (
        <div className="nm-ai-overlay" onClick={() => setShowAiComingSoon(false)}>
          <div className="nm-ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nm-ai-icon"><Sparkles size={40} /></div>
            <h2>Tạo bài viết với AI</h2>
            <p>Tính năng sử dụng trí tuệ nhân tạo để tự động soạn thảo nội dung, tóm tắt bài viết và gợi ý hình ảnh đang được phát triển.</p>
            <div className="nm-ai-badge">Coming Soon</div>
            <button className="nm-btn nm-btn-primary" onClick={() => setShowAiComingSoon(false)}>Tôi đã hiểu</button>
          </div>
        </div>
      )}

      <div className="nm-toolbar">
        <div className="nm-toolbar-left">
          <h3 className="nm-title">Quản lý tin tức</h3>
          <span className="nm-count">{totalElements} bài viết</span>
        </div>
        <div className="nm-toolbar-right">
          <div className="nm-search">
            <Search size={14} />
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Tìm kiếm..."
            />
          </div>
          <select className="nm-select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="">Tất cả danh mục</option>
            {NEWS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="nm-btn nm-btn-primary" onClick={startNew}>
            <Plus size={15} /> Thêm bài viết
          </button>
          <button className="nm-btn nm-btn-ghost" onClick={() => loadArticles(0)} disabled={loading}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {showForm && (
        <div className="nm-card nm-form-card">
          <div className="nm-card-h">
            <h3>{editingId ? "Sửa bài viết" : "Tạo bài viết mới"}</h3>
            <button className="nm-btn nm-btn-ghost nm-btn-sm" onClick={cancelEdit}>✕</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="nm-form-layout">
              <div className="nm-form-main">
                <div className="nm-field">
                  <label>Tiêu đề</label>
                  <input className="nm-input nm-input-lg" value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Nhập tiêu đề..." required />
                </div>
                <div className="nm-field">
                  <label>Đường dẫn (Slug)</label>
                  <div className="nm-input-group">
                    <input className="nm-input" value={form.slug}
                      onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                      placeholder="tu-dong-sinh-tu-tieu-de" />
                    <button type="button" className="nm-btn nm-btn-sm" onClick={() => autoSlug(form.title)}>
                      Tạo slug
                    </button>
                  </div>
                  <span className="nm-hint">URL: /news/{form.slug || "ten-bai-viet"}</span>
                </div>
                <div className="nm-field">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "8px" }}>
                    <label style={{ marginBottom: 0 }}>Nội dung bài viết</label>
                    <div className="nm-preview-toggle">
                      <button type="button" className={`nm-btn-tab ${editorMode === "block" ? "active" : ""}`} onClick={() => setEditorMode("block")}>Giao diện khối</button>
                      <button type="button" className={`nm-btn-tab ${editorMode === "code" ? "active" : ""}`} onClick={() => setEditorMode("code")}>Mã HTML</button>
                      <span style={{ width: "1px", height: "14px", background: "#e5e7eb", margin: "0 4px" }} />
                      <button type="button" className={`nm-btn-tab ${previewMode ? "active" : ""}`} onClick={() => setPreviewMode(!previewMode)}>{previewMode ? "Đóng xem trước" : "Xem trước"}</button>
                    </div>
                  </div>
                  
                  {previewMode ? (
                    <div className="nm-preview-area news-detail-content" dangerouslySetInnerHTML={{ __html: form.content || "<p style='color: #9ca3af; font-style: italic;'>Chưa có nội dung để xem trước...</p>" }} />
                  ) : editorMode === "code" ? (
                    <textarea className="nm-input nm-textarea-code" value={form.content}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, content: e.target.value }));
                        // We don't sync back to blocks in real-time code mode to avoid parsing errors
                      }}
                      onBlur={(e) => setBlocks(htmlToBlocks(e.target.value))}
                      rows={12} placeholder="<p>Nội dung bài viết...</p>" />
                  ) : (
                    <div className="nm-block-editor">
                      {blocks.map((block, idx) => (
                        <div key={block.id} className="nm-block-item">
                          <div className="nm-block-toolbar">
                            <span className="nm-block-type">{block.type === "text" ? "Văn bản" : block.type === "heading" ? "Tiêu đề" : block.type === "image" ? "Hình ảnh" : "Bảng"}</span>
                            <button type="button" className="nm-block-del" onClick={() => removeBlock(block.id)}>✕</button>
                          </div>
                          <div className="nm-block-body">
                            {block.type === "text" && (
                              <textarea className="nm-block-input" value={block.value} placeholder="Nhập văn bản..."
                                onChange={(e) => updateBlock(block.id, { value: e.target.value })}
                                style={{ height: "auto", minHeight: "80px" }}
                                onInput={(e) => {
                                  const t = e.target as HTMLTextAreaElement;
                                  t.style.height = "auto";
                                  t.style.height = t.scrollHeight + "px";
                                }}
                              />
                            )}
                            {block.type === "heading" && (
                              <div style={{ display: "flex", gap: "8px" }}>
                                <select className="nm-block-select" value={block.level} onChange={(e) => updateBlock(block.id, { level: parseInt(e.target.value) })}>
                                  <option value={2}>H2</option>
                                  <option value={3}>H3</option>
                                  <option value={4}>H4</option>
                                </select>
                                <input className="nm-block-input nm-heading-input" value={block.value} placeholder="Tiêu đề..."
                                  onChange={(e) => updateBlock(block.id, { value: e.target.value })} />
                              </div>
                            )}
                            {block.type === "image" && (
                              <div className="nm-block-image-form">
                                {block.value ? (
                                  <div className="nm-block-img-preview">
                                    <img src={block.value} alt="" />
                                    <button type="button" className="nm-img-rm" onClick={() => updateBlock(block.id, { value: "" })}>✕</button>
                                  </div>
                                ) : (
                                  <div className="nm-img-placeholder" onClick={() => {
                                    if (form.images.length > 0) {
                                      // If gallery has images, focus there or show a hint
                                      pushMsg("Hãy nhấn vào ảnh trong 'Thư viện ảnh' ở bên phải để chọn", "success");
                                    } else {
                                      const url = prompt("Nhập URL ảnh hoặc upload ảnh vào 'Thư viện ảnh' bên phải:");
                                      if (url) updateBlock(block.id, { value: url });
                                    }
                                  }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: "8px", opacity: 0.5 }}>
                                      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                                    </svg>
                                    <span>{form.images.length > 0 ? "Nhấn để chọn từ Thư viện (bên phải)" : "Chưa có ảnh - Hãy upload vào Thư viện"}</span>
                                  </div>
                                )}
                                <input className="nm-block-input" value={block.caption} placeholder="Nhập chú thích cho ảnh này..."
                                  onChange={(e) => updateBlock(block.id, { caption: e.target.value })} />
                                <div className="nm-block-align">
                                  <span style={{ fontSize: "0.75rem", color: "#9ca3af", marginRight: "4px" }}>Căn lề:</span>
                                  {["left", "center", "right"].map((a) => (
                                    <button key={a} type="button" className={`nm-btn-tab ${block.align === a ? "active" : ""}`}
                                      onClick={() => updateBlock(block.id, { align: a })}>{a === "left" ? "Trái" : a === "center" ? "Giữa" : "Phải"}</button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {block.type === "table" && (
                              <div className="nm-block-table-editor">
                                <div className="nm-table-actions">
                                  <button type="button" className="nm-btn-tab" onClick={() => addTableRow(block.id)}>+ Dòng</button>
                                  <button type="button" className="nm-btn-tab" onClick={() => addTableCol(block.id)}>+ Cột</button>
                                </div>
                                <div className="nm-table-scroll">
                                  <table className="nm-visual-table">
                                    <thead>
                                      <tr>
                                        {block.rows[0].map((_, ci) => (
                                          <th key={ci}>
                                            <div className="nm-cell-h">
                                              <span>Cột {ci + 1}</span>
                                              <button type="button" className="nm-cell-del" onClick={() => removeTableCol(block.id, ci)}>✕</button>
                                            </div>
                                          </th>
                                        ))}
                                        <th style={{ width: "40px" }}></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {block.rows.map((row, ri) => (
                                        <tr key={ri}>
                                          {row.map((cell, ci) => (
                                            <td key={ci}>
                                              <input className="nm-cell-input" value={cell}
                                                onChange={(e) => updateTableCell(block.id, ri, ci, e.target.value)}
                                                placeholder="..." />
                                            </td>
                                          ))}
                                          <td>
                                            <button type="button" className="nm-cell-del" onClick={() => removeTableRow(block.id, ri)}>✕</button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="nm-block-add">
                        <button type="button" className="nm-btn nm-btn-ghost nm-btn-sm" onClick={() => addBlock("text")}>+ Văn bản</button>
                        <button type="button" className="nm-btn nm-btn-ghost nm-btn-sm" onClick={() => addBlock("heading")}>+ Tiêu đề</button>
                        <button type="button" className="nm-btn nm-btn-ghost nm-btn-sm" onClick={() => addBlock("image")}>+ Hình ảnh</button>
                        <button type="button" className="nm-btn nm-btn-ghost nm-btn-sm" onClick={() => addBlock("table")}>+ Bảng</button>
                        <span style={{ width: "1px", height: "20px", background: "#e5e7eb", margin: "0 4px" }} />
                        <button type="button" className="nm-btn nm-btn-ai nm-btn-sm" onClick={() => setShowAiComingSoon(true)}>
                          <Sparkles size={14} /> Tạo với AI
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="nm-field">
                  <label>Mô tả ngắn</label>
                  <textarea className="nm-input" value={form.excerpt}
                    onChange={(e) => setForm((p) => ({ ...p, excerpt: e.target.value }))}
                    rows={3} placeholder="Tóm tắt hiển thị trên thẻ bài viết..." />
                  <span className="nm-hint">{form.excerpt.length} ký tự</span>
                </div>
              </div>
              <div className="nm-form-sidebar">
                <div className="nm-sidebar-tb">
                  <span className="nm-sidebar-tb-title">Tùy chỉnh</span>
                  <div style={{ position: "relative" }}>
                    <button type="button" className="nm-panel-btn" onClick={() => setShowPanelMenu((p) => !p)}
                      title="Hiện/ẩn panel">
                      <Eye size={14} />
                    </button>
                    {showPanelMenu && (
                      <div className="nm-panel-menu" ref={panelMenuRef}>
                        {SIDEBAR_PANELS.map((p) => (
                          <label key={p.id} className="nm-panel-mi">
                            <input type="checkbox" checked={!hiddenPanels[p.id]}
                              onChange={() => setHiddenPanels((prev) => ({ ...prev, [p.id]: !prev[p.id] }))} />
                            <span>{p.title}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {sidebarOrder.map((pid, idx) => {
                  if (hiddenPanels[pid]) return null;
                  const panel = SIDEBAR_PANELS.find((p) => p.id === pid);
                  const isCollapsed = collapsedPanels[pid];
                  const isDrag = dragIdx === idx;
                  return (
                    <div key={pid} className={`nm-sidebar-card${isDrag ? " nm-dragging" : ""}`}
                      draggable
                      onDragStart={() => setDragIdx(idx)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragIdx((from) => {
                          if (from === null || from === idx) return from;
                          setSidebarOrder((prev) => {
                            const arr = [...prev];
                            const [m] = arr.splice(from, 1);
                            arr.splice(idx, 0, m);
                            return arr;
                          });
                          return idx;
                        });
                      }}
                      onDragEnd={() => setDragIdx(null)}
                    >
                      <div className="nm-sidebar-card-h">
                        <span className="nm-drag-h">⠿</span>
                        <h4>{panel?.title}</h4>
                        <div className="nm-sidebar-card-acts">
                          <button type="button" className="nm-panel-btn" onClick={() => setCollapsedPanels((p) => ({ ...p, [pid]: !p[pid] }))}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0)", transition: "transform 0.2s" }}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                          <button type="button" className="nm-panel-btn" onClick={() => setHiddenPanels((p) => ({ ...p, [pid]: true }))}>✕</button>
                        </div>
                      </div>
                      {!isCollapsed && (
                        <div className="nm-sidebar-card-body">
                          {pid === "publish" && (
                            <>
                              <label className="nm-toggle">
                                <input type="checkbox" checked={form.published}
                                  onChange={(e) => setForm((p) => ({ ...p, published: e.target.checked }))} />
                                <span className="nm-toggle-tr"><span className="nm-toggle-th" /></span>
                                <span>{form.published ? "Đã xuất bản" : "Bản nháp"}</span>
                              </label>
                              <label className="nm-toggle">
                                <input type="checkbox" checked={form.featured}
                                  onChange={(e) => setForm((p) => ({ ...p, featured: e.target.checked }))} />
                                <span className="nm-toggle-tr"><span className="nm-toggle-th" /></span>
                                <span>{form.featured ? "Nổi bật" : "Thường"}</span>
                              </label>
                            </>
                          )}
                          {pid === "category" && (
                            <select className="nm-input" value={form.category}
                              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                              {NEWS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          )}
                          {pid === "image" && (
                            <>
                              {form.imageUrl ? (
                                <div className="nm-img-preview">
                                  <img src={form.imageUrl} alt="" />
                                  <button type="button" className="nm-img-rm" onClick={() => setForm((p) => ({ ...p, imageUrl: "" }))}>✕</button>
                                </div>
                              ) : (
                                <div className="nm-img-placeholder" onClick={() => document.getElementById("nm-img-inp")?.click()}>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                  </svg>
                                  <span>Upload ảnh</span>
                                </div>
                              )}
                              <input type="file" accept="image/*" id="nm-img-inp" style={{ display: "none" }}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, false); e.target.value = ""; }} />
                              <input className="nm-input nm-input-sm" value={form.imageUrl}
                                onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
                                placeholder="Hoặc nhập URL..." />
                              {imageUploading && <div className="nm-upload-progress">Đang tải...</div>}
                            </>
                          )}
                          {pid === "gallery" && (
                            <>
                              <div className="nm-gallery-grid">
                                {form.images.map((url, i) => (
                                  <div key={i} className="nm-gallery-item" onClick={() => {
                                    // 1. If there's an empty Featured Image, offer to set it
                                    if (!form.imageUrl) {
                                      if (confirm("Dùng ảnh này làm Ảnh đại diện cho bài viết?")) {
                                        setForm(p => ({ ...p, imageUrl: url }));
                                        return;
                                      }
                                    }
                                    // 2. If block editor is active, try to find an empty image block
                                    const emptyIdx = blocks.findIndex(b => b.type === "image" && !b.value);
                                    if (emptyIdx !== -1) {
                                      updateBlock(blocks[emptyIdx].id, { value: url });
                                      pushMsg("Đã chèn ảnh vào khối", "success");
                                    } else {
                                      // 3. Otherwise just copy URL or ask to add new block
                                      if (confirm("Chèn ảnh này vào một khối mới?")) {
                                        const id = Math.random().toString(36).slice(2, 9);
                                        updateFormContent([...blocks, { id, type: "image", value: url, caption: "", align: "center" }]);
                                      }
                                    }
                                  }}>
                                    <img src={url} alt="" />
                                    <div className="nm-gallery-ov">
                                      <span className="nm-gallery-hint">Click để chèn</span>
                                      <button type="button" className="nm-gallery-btn nm-gallery-btn-rm" title="Xóa khỏi thư viện"
                                        onClick={(e) => { e.stopPropagation(); removeGalleryImg(i); }}>✕</button>
                                    </div>
                                  </div>
                                ))}
                                <div className="nm-gallery-add" onClick={() => document.getElementById("nm-gallery-inp")?.click()} title="Tải ảnh lên thư viện">
                                  <Plus size={20} />
                                </div>
                              </div>
                              <input type="file" accept="image/*" id="nm-gallery-inp" style={{ display: "none" }}
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, true); e.target.value = ""; }} />
                              <input className="nm-input nm-input-sm" placeholder="Paste URL + Enter"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const val = (e.target as HTMLInputElement).value.trim();
                                    if (val) { setForm((p) => ({ ...p, images: [...p.images, val] })); (e.target as HTMLInputElement).value = ""; }
                                  }
                                }} />
                            </>
                          )}
                          {pid === "tags" && (
                            <>
                              <input className="nm-input" value={form.tags}
                                onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                                placeholder="tag1, tag2, tag3" />
                              <div className="nm-tags">
                                {form.tags.split(",").filter(Boolean).map((t, i) => (
                                  <span key={i} className="nm-tag">{t.trim()}</span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="nm-sidebar-acts">
                  <button className="nm-btn nm-btn-primary nm-btn-block" type="submit" disabled={saving}>
                    {saving ? "Đang lưu..." : editingId ? "Cập nhật" : "Đăng bài"}
                  </button>
                  <button className="nm-btn nm-btn-ghost nm-btn-block" type="button" onClick={cancelEdit}>
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="nm-card">
        <div className="nm-table-wrap">
          {loading ? (
            <div className="nm-empty">Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div className="nm-empty">
              <p>{searchText || catFilter ? "Không tìm thấy bài viết phù hợp" : "Chưa có bài viết nào"}</p>
            </div>
          ) : (
            <>
              <table className="nm-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Tiêu đề</th>
                    <th>Danh mục</th>
                    <th>Trạng thái</th>
                    <th>Nổi bật</th>
                    <th>Tác giả</th>
                    <th>Ngày</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.id}>
                      <td className="nm-id">{a.id}</td>
                      <td>
                        <strong>{a.title}</strong>
                        <div className="nm-subtle">{a.excerpt?.slice(0, 60)}</div>
                      </td>
                      <td><span className="nm-cat-badge">{a.category}</span></td>
                      <td>
                        <span className={`nm-dot ${a.published ? "green" : "gray"}`} />
                        {a.published ? "Công khai" : "Nháp"}
                      </td>
                      <td>{a.featured ? <span className="nm-star">★</span> : "—"}</td>
                      <td>{a.authorName}</td>
                      <td className="nm-date">{formatDate(a.createdAt)}</td>
                      <td className="nm-actions">
                        <button className="nm-btn nm-btn-xs" onClick={() => startEdit(a)}>Sửa</button>
                        <button className="nm-btn nm-btn-xs nm-btn-danger" onClick={() => handleDelete(a)}>Xóa</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="nm-pagination">
                  <button className="nm-btn nm-btn-xs" disabled={page === 0}
                    onClick={() => loadArticles(page - 1)}>← Trước</button>
                  <span>Trang {page + 1} / {totalPages}</span>
                  <button className="nm-btn nm-btn-xs" disabled={page >= totalPages - 1}
                    onClick={() => loadArticles(page + 1)}>Sau →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .nm-shell { display: flex; flex-direction: column; gap: 1rem; position: relative; }
        .nm-toast {
          position: fixed; top: 1rem; right: 1rem; z-index: 999;
          padding: 0.65rem 1.25rem; border-radius: 10px; font-size: 0.85rem; font-weight: 600;
          animation: nmIn 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes nmIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        .nm-toast-success { background: rgba(16,185,129,0.1); color: #059669; border: 1px solid rgba(16,185,129,0.2); }
        .nm-toast-error { background: rgba(239,68,68,0.1); color: #dc2626; border: 1px solid rgba(239,68,68,0.2); }

        .nm-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .nm-toolbar-left { display: flex; align-items: center; gap: 0.75rem; }
        .nm-toolbar-right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .nm-title { font-size: 1.05rem; font-weight: 700; color: #111827; margin: 0; }
        .nm-count { font-size: 0.8rem; color: #9ca3af; font-weight: 500; }
        .nm-search {
          display: flex; align-items: center; gap: 0.4rem;
          padding: 0.45rem 0.75rem; background: #fff; border: 1px solid #e5e7eb;
          border-radius: 10px; color: #9ca3af; width: 200px;
        }
        .nm-search input { border: none; outline: none; background: transparent; font-size: 0.85rem; color: #111827; width: 100%; font-family: inherit; }
        .nm-select {
          padding: 0.45rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 10px;
          background: #fff; font-size: 0.85rem; color: #374151; font-family: inherit;
        }

        .nm-btn {
          display: inline-flex; align-items: center; gap: 0.35rem;
          padding: 0.55rem 1rem; border-radius: 10px; border: 1px solid transparent;
          font-size: 0.85rem; font-weight: 600; cursor: pointer;
          transition: all 0.15s; font-family: inherit;
        }
        .nm-btn-primary { background: #4f46e5; color: #fff; box-shadow: 0 1px 3px rgba(79,70,229,0.2); }
        .nm-btn-primary:hover { background: #4338ca; }
        .nm-btn-ghost { background: #fff; color: #374151; border-color: #e5e7eb; }
        .nm-btn-ghost:hover { background: #f9fafb; border-color: #d1d5db; }
        .nm-btn-xs { padding: 0.3rem 0.65rem; font-size: 0.78rem; background: #f3f4f6; color: #374151; border-color: #e5e7eb; }
        .nm-btn-xs:hover { background: #fff; }
        .nm-btn-sm { padding: 0.35rem 0.7rem; font-size: 0.8rem; border-radius: 8px; background: #f3f4f6; color: #374151; border-color: #e5e7eb; }
        .nm-btn-sm:hover { background: #fff; }
        .nm-btn-danger { background: rgba(239,68,68,0.06); color: #ef4444; border-color: rgba(239,68,68,0.12); }
        .nm-btn-danger:hover { background: rgba(239,68,68,0.1); }
        .nm-btn-block { width: 100%; justify-content: center; }
        .nm-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .nm-card { background: #fff; border-radius: 16px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .nm-form-card { border: 1px solid #e5e7eb; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .nm-card-h { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
        .nm-card-h h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #111827; }

        .nm-table-wrap { overflow: auto; border-radius: 12px; border: 1px solid #f3f4f6; }
        .nm-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
        .nm-table thead { background: #fafbfc; }
        .nm-table th, .nm-table td { padding: 0.65rem 0.8rem; border-bottom: 1px solid #f3f4f6; text-align: left; vertical-align: middle; }
        .nm-table th { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; }
        .nm-table tbody tr:hover { background: rgba(99,102,241,0.02); }
        .nm-table tbody tr:last-child td { border-bottom: none; }
        .nm-id { font-weight: 600; color: #9ca3af; font-size: 0.82rem; }
        .nm-subtle { font-size: 0.78rem; color: #9ca3af; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 280px; }
        .nm-date { color: #9ca3af; font-size: 0.82rem; white-space: nowrap; }
        .nm-actions { display: flex; gap: 0.35rem; }
        .nm-cat-badge {
          display: inline-block; padding: 0.15rem 0.55rem; border-radius: 999px;
          background: rgba(99,102,241,0.06); color: #6366f1; font-size: 0.75rem; font-weight: 600;
        }
        .nm-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 0.35rem; }
        .nm-dot.green { background: #10b981; }
        .nm-dot.gray { background: #d1d5db; }
        .nm-star { color: #f59e0b; font-size: 1rem; }

        .nm-pagination {
          display: flex; align-items: center; justify-content: center; gap: 0.75rem;
          padding: 0.75rem 0; font-size: 0.85rem; color: #6b7280;
        }

        .nm-empty { display: flex; align-items: center; justify-content: center; padding: 2.5rem; color: #9ca3af; font-size: 0.9rem; }

        .nm-form-layout { display: grid; grid-template-columns: 1fr 300px; gap: 1.25rem; align-items: start; }
        .nm-form-main { display: flex; flex-direction: column; gap: 1rem; }
        .nm-form-sidebar { display: flex; flex-direction: column; gap: 1rem; }

        .nm-field { display: flex; flex-direction: column; gap: 0.35rem; }
        .nm-field label { font-size: 0.82rem; font-weight: 600; color: #374151; }
        .nm-hint { font-size: 0.75rem; color: #9ca3af; }

        .nm-input { width: 100%; padding: 0.6rem 0.8rem; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; color: #111827; font-size: 0.9rem; font-family: inherit; transition: all 0.2s; box-sizing: border-box; }
        .nm-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .nm-input-lg { font-size: 1.1rem; font-weight: 600; padding: 0.75rem 1rem; }
        .nm-input-sm { font-size: 0.82rem; padding: 0.45rem 0.65rem; }
        .nm-input-group { display: flex; gap: 0.5rem; }
        .nm-input-group .nm-input { flex: 1; }
        .nm-textarea-code { font-family: "SF Mono", "Fira Code", monospace; font-size: 0.85rem; line-height: 1.6; resize: vertical; min-height: 180px; }

        .nm-editor-tb { display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.65rem; background: #fafbfc; border: 1px solid #e5e7eb; border-bottom: none; border-radius: 10px 10px 0 0; flex-wrap: wrap; }
        .nm-editor-btn { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.5rem; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; color: #374151; font-size: 0.78rem; cursor: pointer; font-weight: 500; min-width: 28px; justify-content: center; }
        .nm-editor-btn:hover { border-color: #6366f1; color: #6366f1; }
        .nm-tb-sep { width: 1px; height: 16px; background: #e5e7eb; margin: 0 0.25rem; }
        .nm-editor-hint { font-size: 0.72rem; color: #9ca3af; margin-left: auto; }

        .nm-preview-toggle { display: flex; background: #f3f4f6; border-radius: 8px; padding: 2px; gap: 2px; }
        .nm-btn-tab { border: none; background: transparent; padding: 0.25rem 0.75rem; font-size: 0.75rem; font-weight: 600; color: #6b7280; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .nm-btn-tab.active { background: #fff; color: #6366f1; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

        .nm-preview-area {
          border: 1px solid #e5e7eb; border-radius: 10px; padding: 1.5rem; min-height: 250px;
          background: #fff; max-height: 500px; overflow-y: auto;
        }

        .nm-block-editor { display: flex; flex-direction: column; gap: 1rem; padding: 1rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; }
        .nm-block-item { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
        .nm-block-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.75rem; background: #fafbfc; border-bottom: 1px solid #f3f4f6; }
        .nm-block-type { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: #9ca3af; letter-spacing: 0.05em; }
        .nm-block-del { border: none; background: transparent; color: #d1d5db; cursor: pointer; font-size: 0.8rem; padding: 2px 6px; border-radius: 4px; }
        .nm-block-del:hover { background: #fee2e2; color: #ef4444; }
        .nm-block-body { padding: 0.75rem; }
        .nm-block-input { width: 100%; border: 1px solid transparent; padding: 0.5rem; font-family: inherit; font-size: 0.95rem; color: #111827; outline: none; transition: all 0.2s; border-radius: 6px; }
        .nm-block-input:focus { border-color: #e5e7eb; background: #fafbfc; }
        .nm-heading-input { font-weight: 700; font-size: 1.2rem; }
        .nm-block-select { border: 1px solid #e5e7eb; border-radius: 6px; padding: 2px 4px; font-size: 0.8rem; font-weight: 600; color: #374151; }
        .nm-block-add { display: flex; gap: 0.5rem; justify-content: center; padding: 1rem 0; border: 2px dashed #e5e7eb; border-radius: 10px; margin-top: 0.5rem; }
        .nm-block-image-form { display: flex; flex-direction: column; gap: 0.75rem; }
        .nm-block-img-preview { position: relative; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; max-height: 200px; }
        .nm-block-img-preview img { width: 100%; height: 100%; object-fit: contain; background: #f3f4f6; }
        .nm-block-align { display: flex; gap: 4px; margin-top: 4px; }

        .nm-block-table-editor { display: flex; flex-direction: column; gap: 0.75rem; }
        .nm-table-actions { display: flex; gap: 0.5rem; }
        .nm-table-scroll { overflow-x: auto; border: 1px solid #f1f5f9; border-radius: 8px; }
        .nm-visual-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .nm-visual-table th, .nm-visual-table td { border: 1px solid #f1f5f9; padding: 0.25rem; }
        .nm-visual-table th { background: #f8fafc; }
        .nm-cell-h { display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 2px 4px; color: #94a3b8; font-size: 0.7rem; }
        .nm-cell-input { width: 100%; border: none; padding: 0.4rem; background: transparent; font-size: 0.85rem; outline: none; }
        .nm-cell-input:focus { background: #eff6ff; }
        .nm-cell-del { border: none; background: transparent; color: #cbd5e1; cursor: pointer; padding: 2px; border-radius: 4px; font-size: 0.75rem; }
        .nm-cell-del:hover { background: #fee2e2; color: #ef4444; }

        .nm-sidebar-tb { display: flex; align-items: center; justify-content: space-between; padding: 0.25rem 0; }
        .nm-sidebar-tb-title { font-size: 0.72rem; color: #9ca3af; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
        .nm-panel-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: none; border-radius: 6px; background: transparent; color: #9ca3af; cursor: pointer; transition: all 0.15s; padding: 0; }
        .nm-panel-btn:hover { background: #e5e7eb; color: #374151; }

        .nm-panel-menu { position: absolute; top: 100%; right: 0; z-index: 50; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.1); padding: 0.5rem; min-width: 160px; margin-top: 4px; }
        .nm-panel-mi { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; border-radius: 6px; font-size: 0.82rem; color: #374151; cursor: pointer; white-space: nowrap; }
        .nm-panel-mi:hover { background: #f9fafb; }
        .nm-panel-mi input[type="checkbox"] { accent-color: #6366f1; }

        .nm-sidebar-card { background: #fff; border: 1px solid #f3f4f6; border-radius: 12px; overflow: hidden; transition: box-shadow 0.2s, transform 0.15s; }
        .nm-sidebar-card.nm-dragging { box-shadow: 0 4px 16px rgba(99,102,241,0.15); transform: scale(1.02); border-color: #6366f1; }
        .nm-sidebar-card-h { display: flex; align-items: center; gap: 0.35rem; padding: 0.6rem 0.6rem 0.6rem 0.8rem; border-bottom: 1px solid #f3f4f6; background: #fafbfc; cursor: grab; }
        .nm-sidebar-card-h:active { cursor: grabbing; }
        .nm-sidebar-card-h h4 { margin: 0; flex: 1; font-size: 0.8rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
        .nm-sidebar-card-body { padding: 0.75rem 0.85rem; display: flex; flex-direction: column; gap: 0.65rem; }
        .nm-sidebar-card-acts { display: flex; gap: 0.15rem; }
        .nm-drag-h { font-size: 1rem; color: #b0b7c3; user-select: none; line-height: 1; cursor: grab; }

        .nm-toggle { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; user-select: none; font-size: 0.85rem; font-weight: 500; color: #374151; }
        .nm-toggle input { display: none; }
        .nm-toggle-tr { position: relative; width: 38px; height: 22px; border-radius: 11px; background: #e5e7eb; transition: background 0.2s; flex-shrink: 0; }
        .nm-toggle input:checked + .nm-toggle-tr { background: #6366f1; }
        .nm-toggle-th { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.15); transition: all 0.2s; }
        .nm-toggle input:checked + .nm-toggle-tr .nm-toggle-th { left: 19px; }

        .nm-img-preview { position: relative; border-radius: 10px; overflow: hidden; border: 1px solid #e5e7eb; }
        .nm-img-preview img { width: 100%; height: 140px; object-fit: cover; display: block; }
        .nm-img-rm { position: absolute; top: 5px; right: 5px; width: 24px; height: 24px; border-radius: 50%; border: none; background: rgba(0,0,0,0.5); color: #fff; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .nm-img-rm:hover { background: rgba(239,68,68,0.8); }
        .nm-img-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.4rem; padding: 1.25rem; border: 2px dashed #e5e7eb; border-radius: 10px; cursor: pointer; color: #9ca3af; font-size: 0.8rem; transition: all 0.2s; }
        .nm-img-placeholder:hover { border-color: #6366f1; color: #6366f1; background: rgba(99,102,241,0.03); }
        .nm-upload-progress { font-size: 0.78rem; color: #6366f1; text-align: center; }

        .nm-gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; }
        .nm-gallery-item { position: relative; border-radius: 8px; overflow: hidden; aspect-ratio: 1; background: #f3f4f6; }
        .nm-gallery-item img { width: 100%; height: 100%; object-fit: cover; }
        .nm-gallery-ov { position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.35rem; opacity: 0; transition: opacity 0.2s; cursor: pointer; }
        .nm-gallery-item:hover .nm-gallery-ov { opacity: 1; }
        .nm-gallery-hint { color: #fff; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
        .nm-gallery-btn { width: 24px; height: 24px; border-radius: 50%; border: none; background: rgba(255,255,255,0.9); color: #374151; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .nm-gallery-btn:hover { background: #fff; }
        .nm-gallery-btn-rm { position: absolute; top: 4px; right: 4px; background: rgba(239,68,68,0.2); color: #fff; width: 18px; height: 18px; font-size: 10px; }
        .nm-gallery-btn-rm:hover { background: #ef4444; }
        .nm-gallery-add { display: flex; align-items: center; justify-content: center; border: 2px dashed #e5e7eb; border-radius: 8px; aspect-ratio: 1; cursor: pointer; color: #9ca3af; transition: all 0.2s; }
        .nm-gallery-add:hover { border-color: #6366f1; color: #6366f1; }

        .nm-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }
        .nm-tag { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 6px; background: rgba(99,102,241,0.08); color: #6366f1; font-size: 0.76rem; font-weight: 500; }

        .nm-sidebar-acts { display: flex; flex-direction: column; gap: 0.4rem; }

        @media (max-width: 768px) {
          .nm-form-layout { grid-template-columns: 1fr; }
          .nm-form-sidebar { order: -1; }
          .nm-toolbar { flex-direction: column; align-items: stretch; }
          .nm-toolbar-right { justify-content: stretch; }
          .nm-search { width: 100%; }
        }
      `}</style>
    </div>
  );
}
