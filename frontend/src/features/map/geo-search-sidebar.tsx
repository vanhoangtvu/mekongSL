"use client";

import { useState } from "react";
import { AREA_TYPES, DATASETS } from "../../lib/constants/datasets";

type TabType = "criteria" | "datasets" | "additional" | "results";

type GeoSearchSidebarProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  startDateTime: string;
  endDateTime: string;
  onStartDateTimeChange: (value: string) => void;
  onEndDateTimeChange: (value: string) => void;
  ecowittEnabled?: boolean;
  onEcowittToggle?: (enabled: boolean) => void;
  onApply?: (datasets: Array<{ id: string; type: "raster" | "vector" }>) => void;
};

type SearchTabsProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
};

export function SearchTabs({ activeTab, onTabChange }: SearchTabsProps) {
  return (
    <nav className="search-tabs">
      <button
        className={`search-tab ${activeTab === "criteria" ? "is-active" : ""}`}
        onClick={() => onTabChange("criteria")}
        type="button"
      >
        Search Criteria
      </button>
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
  startDateTime,
  endDateTime,
  onStartDateTimeChange,
  onEndDateTimeChange,
  ecowittEnabled,
  onEcowittToggle,
  onApply,
}: GeoSearchSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["landsat"]));
  const [selectedLayers, setSelectedLayers] = useState<Record<string, "raster" | "vector">>({});
  const [showTypePicker, setShowTypePicker] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState(0);
  const [selectionOrder, setSelectionOrder] = useState<string[]>([]);

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
    if (!cat?.children || cat.children.length === 0) return selectedLayers[categoryId] ? "all" : "none";
    const checked = cat.children.filter((c) => selectedLayers[c.id]).length;
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
        setSelectionOrder((prev) => prev.filter((id) => !allChildIds.includes(id)));
      } else {
        setExpandedCategories((prev) => { const n = new Set(prev); n.add(datasetId); return n; });
        setSelectedLayers((prev) => {
          const next = { ...prev };
          for (const cid of allChildIds) next[cid] = "raster";
          return next;
        });
        setSelectionOrder((prev) => {
          const existing = prev.filter((id) => !allChildIds.includes(id));
          return [...existing, ...allChildIds];
        });
      }
      return;
    }

    if (selectedLayers[datasetId]) {
      setSelectedLayers((prev) => {
        const next = { ...prev };
        delete next[datasetId];
        return next;
      });
      setSelectionOrder((prev) => prev.filter((id) => id !== datasetId));
    } else {
      setShowTypePicker(datasetId);
      setSelectedLayers((prev) => ({ ...prev, [datasetId]: "raster" }));
      setSelectionOrder((prev) => [...prev.filter((id) => id !== datasetId), datasetId]);
    }
  };

  const selectLayerType = (datasetId: string, type: "raster" | "vector") => {
    setSelectedLayers((prev) => ({ ...prev, [datasetId]: type }));
    setShowTypePicker(null);
  };

  const countSelected = () => {
    let count = 0;
    DATASETS.forEach((cat) => {
      if (cat.children) {
        cat.children.forEach((child) => {
          if (selectedLayers[child.id]) count++;
        });
      } else {
        if (selectedLayers[cat.id]) count++;
      }
    });
    return count;
  };

  const applyDatasets = () => {
    const list = selectionOrder
      .filter((id) => selectedLayers[id])
      .map((id) => ({ id, type: selectedLayers[id] }));
    setAppliedCount(list.length);
    onApply?.(list);
  };

  return (
    <aside className="geo-sidebar">
      {/* Tab 1: Search Criteria */}
      {activeTab === "criteria" && (
        <div className="geo-sidebar-content">
          <section className="geo-block">
            <h2>1. Enter Search Criteria</h2>
            <p>
              To narrow your search area: type in an address or place name, enter coordinates or
              click the map to define your search area, and/or choose a date range.
            </p>
          </section>

          <section className="geo-block">
            <label className="geo-label" htmlFor="keyword">
              Address / Place
            </label>
            <input
              id="keyword"
              className="geo-input"
              defaultValue="Vinh Long"
              placeholder="Province, District, Station..."
              type="text"
            />
          </section>

          <section className="geo-block">
            <label className="geo-label" htmlFor="data-type">
              Data
            </label>
            <select id="data-type" className="geo-input">
              <option value="salinity">Salinity</option>
              <option value="temperature">Temperature</option>
              <option value="ph">pH Level</option>
              <option value="conductivity">Conductivity</option>
            </select>
          </section>

          <section className="geo-block geo-grid-2">
            <div>
              <label className="geo-label" htmlFor="start-date">
                Start Date & Time
              </label>
              <input
                id="start-date"
                className="geo-input"
                onChange={(event) => onStartDateTimeChange(event.target.value)}
                type="datetime-local"
                value={startDateTime}
              />
            </div>
            <div>
              <label className="geo-label" htmlFor="end-date">
                End Date & Time
              </label>
              <input
                id="end-date"
                className="geo-input"
                onChange={(event) => onEndDateTimeChange(event.target.value)}
                type="datetime-local"
                value={endDateTime}
              />
            </div>
          </section>
        </div>
      )}

      {/* Tab 2: Data Sets */}
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
                    {!category.children && category.gisData !== false && (
                      <div className="geo-layer-type-col">
                        {showTypePicker === category.id ? (
                          <div className="geo-layer-type-picker">
                            <button className={`geo-layer-type-opt${selectedLayers[category.id] === "raster" ? " is-selected" : ""}`} onClick={() => selectLayerType(category.id, "raster")} type="button">Raster</button>
                            <button className={`geo-layer-type-opt${selectedLayers[category.id] === "vector" ? " is-selected" : ""}`} onClick={() => selectLayerType(category.id, "vector")} type="button">Vector</button>
                          </div>
                        ) : selectedLayers[category.id] ? (
                          <span className="geo-layer-type-badge" onClick={() => setShowTypePicker(category.id)}>{selectedLayers[category.id]}</span>
                        ) : null}
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
                              checked={!!selectedLayers[child.id]}
                              onChange={() => toggleDataset(child.id)}
                            />
                            <span className="geo-dataset-child-content">
                              <span className="geo-dataset-child-name">{child.name}</span>
                            </span>
                          </label>
                          {child.gisData !== false && (
                            <div className="geo-layer-type-col">
                              {showTypePicker === child.id ? (
                                <div className="geo-layer-type-picker">
                                  <button className={`geo-layer-type-opt${selectedLayers[child.id] === "raster" ? " is-selected" : ""}`} onClick={() => selectLayerType(child.id, "raster")} type="button">Raster</button>
                                  <button className={`geo-layer-type-opt${selectedLayers[child.id] === "vector" ? " is-selected" : ""}`} onClick={() => selectLayerType(child.id, "vector")} type="button">Vector</button>
                                </div>
                              ) : selectedLayers[child.id] ? (
                                <span className="geo-layer-type-badge" onClick={() => setShowTypePicker(child.id)}>{selectedLayers[child.id]}</span>
                              ) : null}
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

          <section className="geo-block" style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <label className="geo-dataset-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!ecowittEnabled}
                onChange={(e) => onEcowittToggle?.(e.target.checked)}
              />
              <span className="geo-dataset-name" style={{ fontWeight: 600 }}>Ecowitt Stations</span>
            </label>
            <p style={{ margin: '6px 0 0 24px', fontSize: '0.8rem', color: '#94a3b8' }}>
              Hiển thị trạm quan trắc thời tiết Ecowitt trên bản đồ
            </p>
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
