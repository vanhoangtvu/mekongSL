"use client";

import { useState, useEffect } from "react";
import { AREA_TYPES, DATASETS, getDatasetById } from "../../lib/constants/datasets";

type TabType = "datasets" | "additional" | "results";

type GeoSearchSidebarProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onApply?: (datasets: Array<{ id: string; type: "raster" | "vector" }>) => void;
  appliedDatasets?: Array<{ id: string; type: string }>;
  isMobile?: boolean;
  isSidebarOpen?: boolean;
  onClose?: () => void;
};

type SearchTabsProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
};

export function SearchTabs({ activeTab, onTabChange }: SearchTabsProps) {
  return (
    <nav className="search-tabs">
      <button
        className={`search-tab ${activeTab === "datasets" ? "is-active" : ""}`}
        onClick={() => onTabChange("datasets")}
        type="button"
      >
        Data Sets
      </button>
      <button
        className={`search-tab ${activeTab === "additional" ? "is-active" : ""}`}
        onClick={() => onTabChange("additional")}
        type="button"
      >
        Additional Criteria
      </button>
      <button
        className={`search-tab ${activeTab === "results" ? "is-active" : ""}`}
        onClick={() => onTabChange("results")}
        type="button"
      >
        Results
      </button>
    </nav>
  );
}

export function GeoSearchSidebar({
  activeTab,
  onTabChange,
  onApply,
  appliedDatasets,
  isMobile,
  isSidebarOpen,
  onClose,
}: GeoSearchSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["landsat"]));
  const [selectedLayers, setSelectedLayers] = useState<Record<string, ("raster" | "vector")[]>>({});
  const [showTypePicker, setShowTypePicker] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);

  // Sync selectedLayers khi appliedDatasets thay đổi từ bên ngoài (vd: xóa từ player)
  useEffect(() => {
    if (!appliedDatasets) return;
    setSelectedLayers(() => {
      const next: Record<string, ("raster" | "vector")[]> = {};
      for (const { id, type } of appliedDatasets) {
        if (type === "raster" || type === "vector") {
          if (!next[id]) next[id] = [];
          if (!next[id].includes(type)) next[id].push(type); // dedup
        }
      }
      return next;
    });
  }, [appliedDatasets]);
  const [selectionOrder, setSelectionOrder] = useState<{id: string; type: "raster" | "vector"}[]>([]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  /** Check if a parent has all its children selected */
  const getParentState = (categoryId: string): "all" | "some" | "none" => {
    const cat = DATASETS.find((c) => c.id === categoryId);
    if (!cat?.children || cat.children.length === 0) return selectedLayers[categoryId]?.length > 0 ? "all" : "none";
    const checked = cat.children.filter((c) => selectedLayers[c.id]?.length > 0).length;
    if (checked === 0) return "none";
    if (checked === cat.children.length) return "all";
    return "some";
  };

  const toggleDataset = (datasetId: string) => {
    // If this ID is a parent category with children → toggle all children, skip parent itself
    const category = DATASETS.find((c) => c.id === datasetId);
    if (category?.children) {
      const allChildIds = category.children.map((c) => c.id);
      const state = getParentState(datasetId);
      if (state === "all") {
        setSelectedLayers((prev) => {
          const next = { ...prev };
          for (const cid of allChildIds) delete next[cid];
          return next;
        });
        setSelectionOrder((prev) => prev.filter((item) => !allChildIds.includes(item.id)));
      } else {
        setExpandedCategories((prev) => { const n = new Set(prev); n.add(datasetId); return n; });
        setSelectedLayers((prev) => {
          const next = { ...prev };
          for (const cid of allChildIds) next[cid] = ["raster"];
          return next;
        });
        setSelectionOrder((prev) => {
          const existing = prev.filter((item) => !allChildIds.includes(item.id));
          return [...existing, ...allChildIds.map(id => ({ id, type: "raster" as const }))];
        });
      }
      return;
    }

    if (selectedLayers[datasetId]?.length > 0) {
      setSelectedLayers((prev) => {
        const next = { ...prev };
        delete next[datasetId];
        return next;
      });
      setSelectionOrder((prev) => prev.filter((item) => item.id !== datasetId));
      setShowTypePicker(null);
    } else {
      setSelectedLayers((prev) => ({ ...prev, [datasetId]: ["raster"] }));
      setSelectionOrder((prev) => [...prev.filter((item) => item.id !== datasetId), { id: datasetId, type: "raster" }]);
    }
  };

  const toggleLayerType = (datasetId: string, type: "raster" | "vector") => {
    setSelectedLayers((prev) => {
      const current = prev[datasetId] || [];
      const isSelected = current.includes(type);
      let nextTypes: ("raster" | "vector")[];
      if (isSelected) {
        nextTypes = current.filter(t => t !== type);
        setSelectionOrder(order => order.filter(item => !(item.id === datasetId && item.type === type)));
      } else {
        nextTypes = [...current, type];
        setSelectionOrder(order => [...order, { id: datasetId, type }]);
      }
      const next = { ...prev };
      if (nextTypes.length === 0) delete next[datasetId];
      else next[datasetId] = nextTypes;
      return next;
    });
  };

  const closeTypePicker = () => {
     setShowTypePicker(null);
  };

  const countSelected = () => {
    let count = 0;
    DATASETS.forEach((cat) => {
      if (cat.children) {
        cat.children.forEach((child) => {
          if (selectedLayers[child.id]?.length > 0) count++;
        });
      } else {
        if (selectedLayers[cat.id]?.length > 0) count++;
      }
    });
    return count;
  };

  const applyDatasets = () => {
    const list = selectionOrder
      .filter((item) => selectedLayers[item.id]?.includes(item.type));
    setAppliedCount(list.length);
    onApply?.(list);
  };

  return (
    <aside className={`geo-sidebar ${isMobile ? 'geo-sidebar--mobile' : ''}`}>
      {isMobile && (
        <>
          <div className="geo-sidebar-mobile-header">
            <span className="geo-sidebar-mobile-title">Menu</span>
            <button className="geo-sidebar-mobile-close" onClick={onClose} type="button" aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <nav className="search-tabs search-tabs--mobile">
            {(["datasets", "additional", "results"] as const).map((tab) => (
              <button key={tab} className={`search-tab search-tab--mobile ${activeTab === tab ? "is-active" : ""}`}
                onClick={() => onTabChange(tab)} type="button">
                {tab === "datasets" && "Data Sets"}
                {tab === "additional" && "Additional"}
                {tab === "results" && "Results"}
              </button>
            ))}
          </nav>
        </>
      )}

      {/* Tab 1: Data Sets */}
      {activeTab === "datasets" && (
        <div className="geo-sidebar-content">
          <section className="geo-block">
            <h2>2. Select Your Data Set(s)</h2>
            <p>
              Check the boxes for the data set(s) you want to search. Click the plus sign next to
              the category name to show a list of data sets.
            </p>
          </section>

          <section className="geo-block">
            <div className="geo-block-head">
              <h3>Data Sets</h3>
              <span>{countSelected()} selected</span>
            </div>
            <div className="geo-dataset-tree">
              {DATASETS.map((category) => (
                <div key={category.id} className="geo-dataset-category">
                  <div className="geo-dataset-category-header" style={{ position: "relative" }}>
                    {category.children ? (
                      <button
                        className="geo-dataset-toggle"
                        onClick={() => toggleCategory(category.id)}
                        type="button"
                      >
                        <span className="geo-dataset-icon">
                          {expandedCategories.has(category.id) ? "−" : "+"}
                        </span>
                      </button>
                    ) : (
                      <button
                        className="geo-dataset-icon-placeholder"
                        type="button"
                        aria-label="No child datasets"
                        onClick={() => {
                          window.alert("Mục này không có dữ liệu con.");
                        }}
                      >
                        +
                      </button>
                    )}
                    <label className="geo-dataset-label">
                      <input
                        type="checkbox"
                        checked={getParentState(category.id) === "all"}
                        onChange={() => toggleDataset(category.id)}
                        ref={(el) => {
                          if (el) el.indeterminate = getParentState(category.id) === "some";
                        }}
                      />
                      <span className="geo-dataset-name">{category.name}</span>
                    </label>
                    {/* Only GIS leaf datasets need type picker/badge */}
                    {!category.children && category.gisData !== false && (category.group ?? "gis") === "gis" && (selectedLayers[category.id]?.length || 0) > 0 && (
                      <div className="geo-layer-type-col">
                        <div className="geo-layer-type-picker" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <button className={`geo-layer-type-opt${selectedLayers[category.id]?.includes("raster") ? " is-selected" : ""}`} onClick={() => toggleLayerType(category.id, "raster")} type="button">R</button>
                          <button className={`geo-layer-type-opt${selectedLayers[category.id]?.includes("vector") ? " is-selected" : ""}`} onClick={() => toggleLayerType(category.id, "vector")} type="button">V</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {category.children && expandedCategories.has(category.id) && (
                    <div className="geo-dataset-children">
                      {category.children.map((child) => (
                        <div key={child.id} className="geo-dataset-child-wrap">
                          <label className="geo-dataset-child">
                            <input
                              type="checkbox"
                              checked={(selectedLayers[child.id]?.length || 0) > 0}
                              onChange={() => toggleDataset(child.id)}
                            />
                            <span className="geo-dataset-child-content">
                              <span className="geo-dataset-child-name">{child.name}</span>
                            </span>
                          </label>
                          {child.gisData !== false && (category.group ?? "gis") === "gis" && (selectedLayers[child.id]?.length || 0) > 0 && (
                            <div className="geo-layer-type-col">
                              <div className="geo-layer-type-picker" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <button className={`geo-layer-type-opt${selectedLayers[child.id]?.includes("raster") ? " is-selected" : ""}`} onClick={() => toggleLayerType(child.id, "raster")} type="button">R</button>
                                <button className={`geo-layer-type-opt${selectedLayers[child.id]?.includes("vector") ? " is-selected" : ""}`} onClick={() => toggleLayerType(child.id, "vector")} type="button">V</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Tab 3: Additional Criteria */}
      {activeTab === "additional" && (
        <div className="geo-sidebar-content">
          <section className="geo-block">
            <h2>3. Additional Criteria (Optional)</h2>
            <p>
              If you have more than one data sets selected, use the dropdown to select the
              additional criteria for each data set.
            </p>
          </section>

          <section className="geo-block geo-range">
            <div className="geo-block-head">
              <h3>Cloud Cover</h3>
              <span>0 - 100%</span>
            </div>
            <input className="geo-slider" defaultValue="35" min="0" max="100" type="range" />
          </section>
        </div>
      )}

      {/* Tab 4: Results */}
      {activeTab === "results" && (
        <div className="geo-sidebar-content">
          <section className="geo-block">
            <h2>4. Search Results</h2>
            <p>
              If you selected more than one data set to search, use the dropdown to see the search
              results for each specific data set.
            </p>
          </section>

          <section className="geo-block">
            <div className="geo-result-summary">
              <strong>Search Summary:</strong>
              <ul>
                <li>Location: Vinh Long</li>
                <li>Date Range: 2026-05-01 to 2026-05-24</li>
                <li>Data Sets: {appliedCount} applied</li>
                <li>Cloud Cover: ≤ 35%</li>
              </ul>
            </div>
          </section>
        </div>
      )}

      {/* Action Buttons */}
      <div className="geo-sidebar-actions">
        <button className="geo-action" onClick={applyDatasets} type="button">
          Apply
        </button>
      </div>
    </aside>
  );
}
