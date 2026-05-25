"use client";

import { useState } from "react";
import { AREA_TYPES, DATASETS } from "../../lib/constants/datasets";

type TabType = "criteria" | "datasets" | "additional" | "results";

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

export function GeoSearchSidebar({ activeTab, onTabChange }: { activeTab: TabType; onTabChange: (tab: TabType) => void }) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["landsat"]));
  const [selectedDatasets, setSelectedDatasets] = useState<Set<string>>(new Set());

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

  const toggleDataset = (datasetId: string) => {
    setSelectedDatasets((prev) => {
      const next = new Set(prev);
      if (next.has(datasetId)) {
        next.delete(datasetId);
      } else {
        next.add(datasetId);
      }
      return next;
    });
  };

  const countSelected = () => {
    let count = 0;
    DATASETS.forEach((cat) => {
      if (cat.children) {
        cat.children.forEach((child) => {
          if (selectedDatasets.has(child.id)) count++;
        });
      } else {
        if (selectedDatasets.has(cat.id)) count++;
      }
    });
    return count;
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
            <div className="geo-block-head">
              <h3>Area Type</h3>
              <span>Select 1</span>
            </div>
            <div className="geo-chip-grid">
              {AREA_TYPES.map((item, index) => (
                <button
                  className={`geo-chip ${index === 2 ? "is-active" : ""}`}
                  key={item}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section className="geo-block geo-grid-2">
            <div>
              <label className="geo-label" htmlFor="start-date">
                Start Date
              </label>
              <input id="start-date" className="geo-input" defaultValue="2026-05-01" type="date" />
            </div>
            <div>
              <label className="geo-label" htmlFor="end-date">
                End Date
              </label>
              <input id="end-date" className="geo-input" defaultValue="2026-05-24" type="date" />
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
                  <div className="geo-dataset-category-header">
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
                        checked={selectedDatasets.has(category.id)}
                        onChange={() => toggleDataset(category.id)}
                      />
                      <span className="geo-dataset-name">{category.name}</span>
                    </label>
                  </div>

                  {category.children && expandedCategories.has(category.id) && (
                    <div className="geo-dataset-children">
                      {category.children.map((child) => (
                        <label key={child.id} className="geo-dataset-child">
                          <input
                            type="checkbox"
                            checked={selectedDatasets.has(child.id)}
                            onChange={() => toggleDataset(child.id)}
                          />
                          <span className="geo-dataset-child-content">
                            <span className="geo-dataset-child-name">{child.name}</span>
                          </span>
                        </label>
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
                <li>Data Sets: {countSelected()} selected</li>
                <li>Cloud Cover: ≤ 35%</li>
              </ul>
            </div>
          </section>
        </div>
      )}

      {/* Action Buttons */}
      <div className="geo-sidebar-actions">
        {activeTab === "criteria" && (
          <button className="geo-action" onClick={() => onTabChange("datasets")} type="button">
            Data Sets →
          </button>
        )}
        {activeTab === "datasets" && (
          <button className="geo-action" onClick={() => onTabChange("additional")} type="button">
            Additional Criteria →
          </button>
        )}
        {activeTab === "additional" && (
          <button className="geo-action" onClick={() => onTabChange("results")} type="button">
            Results →
          </button>
        )}
        {activeTab === "results" && (
          <button
            className="geo-action geo-action-secondary"
            onClick={() => onTabChange("criteria")}
            type="button"
          >
            ← New Search
          </button>
        )}
      </div>
    </aside>
  );
}
