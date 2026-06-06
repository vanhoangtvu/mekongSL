"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "../../components/layout/app-header";
import { AppFooter } from "../../components/layout/app-footer";
import { SearchTabs, GeoSearchSidebar } from "../../features/map/geo-search-sidebar";
import { ResizablePanel } from "../../components/layout/resizable-panel";
import { MapStage } from "../../features/map/map-stage";
import { listManualStations, type ManualStation } from "../../lib/admin-api";

type TabType = "criteria" | "datasets" | "additional" | "results";

export default function PublicHomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("criteria");
  
  useEffect(() => {
    const saved = localStorage.getItem('homePage:activeTab');
    if (saved === 'criteria' || saved === 'datasets' || saved === 'additional' || saved === 'results') {
      setActiveTab(saved);
    }
  }, []);
  
  const getDefaultRange = () => {
    const now = new Date();
    const end = now.toISOString().slice(0, 16);
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 16);
    return { start, end };
  };
  const [startDateTime, setStartDateTime] = useState(getDefaultRange().start);
  const [endDateTime, setEndDateTime] = useState(getDefaultRange().end);
  const [hasExplicitRange, setHasExplicitRange] = useState(false);
  const [appliedDatasets, setAppliedDatasets] = useState<Array<{ id: string; type: string }>>([]);
  const [wqStations, setWqStations] = useState<ManualStation[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const hasWq = appliedDatasets.some(ds => ds.id === "wq-surface" || ds.id === "wq-ground");
    if (hasWq) {
      listManualStations().then(allStations => {
        const showSurface = appliedDatasets.some(ds => ds.id === "wq-surface");
        const showGround = appliedDatasets.some(ds => ds.id === "wq-ground");
        const filtered = allStations.filter(st => {
          if (showSurface && showGround) return true;
          if (showSurface) return st.stationType === 'surface_water';
          if (showGround) return st.stationType === 'groundwater';
          return false;
        });
        setWqStations(filtered);
      }).catch(() => setWqStations([]));
    } else {
      setWqStations([]);
    }
  }, [appliedDatasets]);

  const handleStartDateTimeChange = (val: string) => {
    setStartDateTime(val);
    setHasExplicitRange(true);
  };
  const handleEndDateTimeChange = (val: string) => {
    setEndDateTime(val);
    setHasExplicitRange(true);
  };

  useEffect(() => {
    localStorage.setItem('homePage:activeTab', activeTab);
  }, [activeTab]);

  const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

  const handleApplyDatasets = (datasets: Array<{ id: string; type: string }>) => {
    setAppliedDatasets(datasets);
    if (isMobile) setIsSidebarOpen(false);
  };

  const handleRemoveDataset = (id: string, type: string) => {
    setAppliedDatasets(prev => prev.filter(d => !(d.id === id && d.type === type)));
  };

  const handleAddDataset = (id: string, type: string) => {
    setAppliedDatasets(prev =>
      prev.some(d => d.id === id && d.type === type) ? prev : [...prev, { id, type }]
    );
  };

  return (
    <div className="app-container public-home">
      <AppHeader onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      
      <main className="app-main">
        <SearchTabs activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className={`app-content ${isSidebarOpen ? 'sidebar-open' : ''}`}>
          <ResizablePanel defaultWidth={360} minWidth={280} maxWidth={600} side="left" isMobile={isMobile} isSidebarOpen={isSidebarOpen}>
            <GeoSearchSidebar
              activeTab={activeTab}
              onTabChange={(tab) => { setActiveTab(tab); if (isMobile) setIsSidebarOpen(false); }}
              startDateTime={startDateTime}
              endDateTime={endDateTime}
              onStartDateTimeChange={handleStartDateTimeChange}
              onEndDateTimeChange={handleEndDateTimeChange}
              onApply={handleApplyDatasets}
              appliedDatasets={appliedDatasets}
              isMobile={isMobile}
              isSidebarOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
            />
          </ResizablePanel>
          <div className="geo-panel">
            <MapStage startDateTime={startDateTime} endDateTime={endDateTime} appliedDatasets={appliedDatasets} onRemoveDataset={handleRemoveDataset} onAddDataset={handleAddDataset} hasExplicitRange={hasExplicitRange} onStartDateTimeChange={handleStartDateTimeChange} onEndDateTimeChange={handleEndDateTimeChange} waterQualityStations={wqStations} isMobile={isMobile} />
            {isMobile && !isSidebarOpen && (
              <button className="map-mobile-menu-btn" onClick={toggleSidebar} type="button" aria-label="Open menu">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </main>
      
      <AppFooter />
    </div>
  );
}
