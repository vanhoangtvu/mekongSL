"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "../../components/layout/app-header";
import { AppFooter } from "../../components/layout/app-footer";
import { SearchTabs, GeoSearchSidebar } from "../../features/map/geo-search-sidebar";
import { ResizablePanel } from "../../components/layout/resizable-panel";
import { MapStage } from "../../features/map/map-stage";
import { listManualStations, type ManualStation } from "../../lib/admin-api";
import { AIChatPanel } from "../../features/ai";
import { Bot } from "lucide-react";

type TabType = "datasets" | "additional" | "results";

export default function PublicHomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("datasets");
  
  useEffect(() => {
    const saved = localStorage.getItem('homePage:activeTab');
    if (saved === 'datasets' || saved === 'additional' || saved === 'results') {
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
  const [hoveredDatasetId, setHoveredDatasetId] = useState<string | null>(null);
  const [wqStations, setWqStations] = useState<ManualStation[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
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

  const handleStartDateTimeChange = useCallback((val: string) => {
    setStartDateTime(val);
    setHasExplicitRange(true);
  }, []);
  
  const handleEndDateTimeChange = useCallback((val: string) => {
    setEndDateTime(val);
    setHasExplicitRange(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('homePage:activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!isMobile) return;
    document.documentElement.classList.toggle('scroll-lock', isSidebarOpen);
    return () => document.documentElement.classList.remove('scroll-lock');
  }, [isMobile, isSidebarOpen]);

  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);

  const handleApplyDatasets = useCallback((datasets: Array<{ id: string; type: string }>) => {
    setAppliedDatasets(datasets);
    if (isMobile) setIsSidebarOpen(false);
  }, [isMobile]);

  const handleRemoveDataset = useCallback((id: string, type: string) => {
    setAppliedDatasets(prev => prev.filter(d => !(d.id === id && d.type === type)));
  }, []);

  const handleAddDataset = useCallback((id: string, type: string) => {
    console.log("[page] handleAddDataset", { id, type });
    setAppliedDatasets(prev => {
      const exists = prev.some(d => d.id === id && d.type === type);
      const next = exists ? prev : [...prev, { id, type }];
      console.log("[page] setAppliedDatasets", { prev, next, exists });
      return next;
    });
  }, []);

  return (
    <div className="app-container public-home">
      <AppHeader onToggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      
      <main className="app-main">
        {!isMobile && <SearchTabs activeTab={activeTab} onTabChange={setActiveTab} />}
        
        <div className={`app-content ${isSidebarOpen ? 'sidebar-open' : ''}`}>
          <ResizablePanel defaultWidth={360} minWidth={280} maxWidth={600} side="left" isMobile={isMobile} isSidebarOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}>
            <GeoSearchSidebar
              activeTab={activeTab}
              onTabChange={(tab) => { setActiveTab(tab); }}
              onApply={handleApplyDatasets}
              appliedDatasets={appliedDatasets}
              isMobile={isMobile}
              isSidebarOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              onHoverDataset={setHoveredDatasetId}
            />
          </ResizablePanel>
          <div className="geo-panel" style={{ position: 'relative', overflow: 'hidden' }}>
            <MapStage startDateTime={startDateTime} endDateTime={endDateTime} appliedDatasets={appliedDatasets} onRemoveDataset={handleRemoveDataset} onAddDataset={handleAddDataset} hasExplicitRange={hasExplicitRange} onStartDateTimeChange={handleStartDateTimeChange} onEndDateTimeChange={handleEndDateTimeChange} waterQualityStations={wqStations} isMobile={isMobile} hoveredDatasetId={hoveredDatasetId} />
            
            {/* AI Assistant Floating Trigger Button */}
            <button
              className={`ai-trigger-fab ${isAIChatOpen ? 'active' : ''}`}
              onClick={() => setIsAIChatOpen(prev => !prev)}
              title="Mở Trợ lý AI Phân tích"
            >
              <div className="ai-fab-icon">
                <Bot size={22} />
              </div>
              <span className="ai-fab-text">AI Assistant</span>
              <span className="ai-fab-badge">PRO</span>
            </button>

            {/* AI Chat Panel */}
            <AIChatPanel
              open={isAIChatOpen}
              onClose={() => setIsAIChatOpen(false)}
            />
          </div>
        </div>
      </main>
      
      <AppFooter />

      <style jsx>{`
        .ai-trigger-fab {
          position: absolute;
          bottom: 28px;
          right: 24px;
          z-index: 99;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 18px;
          border-radius: 999px;
          background: linear-gradient(135deg, #163c66 0%, #20538c 100%);
          border: 1px solid rgba(0, 212, 255, 0.4);
          color: #ffffff;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(0, 212, 255, 0.2);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .ai-trigger-fab:hover {
          transform: translateY(-3px) scale(1.03);
          border-color: rgba(0, 212, 255, 0.8);
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4), 0 0 30px rgba(0, 212, 255, 0.4);
        }
        .ai-trigger-fab.active {
          background: linear-gradient(135deg, #0080ff 0%, #6c63ff 100%);
          border-color: rgba(255, 255, 255, 0.5);
          right: 435px;
        }
        @media (max-width: 640px) {
          .ai-trigger-fab.active {
            display: none;
          }
        }
        .ai-fab-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #00d4ff;
          filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.8));
        }
        .ai-trigger-fab.active .ai-fab-icon {
          color: #ffffff;
        }
        .ai-fab-text {
          font-size: 0.92rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }
        .ai-fab-badge {
          background: rgba(0, 212, 255, 0.2);
          border: 1px solid rgba(0, 212, 255, 0.4);
          color: #00d4ff;
          font-size: 0.65rem;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 6px;
        }
        .ai-trigger-fab.active .ai-fab-badge {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.4);
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}

