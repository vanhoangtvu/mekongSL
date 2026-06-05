"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "../../components/layout/app-header";
import { AppFooter } from "../../components/layout/app-footer";
import { SearchTabs, GeoSearchSidebar } from "../../features/map/geo-search-sidebar";
import { ResizablePanel } from "../../components/layout/resizable-panel";
import { MapStage } from "../../features/map/map-stage";

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

  const handleApplyDatasets = (datasets: Array<{ id: string; type: string }>) => {
    setAppliedDatasets(datasets);
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
      <AppHeader />
      
      <main className="app-main">
        <SearchTabs activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="app-content">
          <ResizablePanel defaultWidth={360} minWidth={280} maxWidth={600} side="left">
            <GeoSearchSidebar
              activeTab={activeTab}
              onTabChange={setActiveTab}
              startDateTime={startDateTime}
              endDateTime={endDateTime}
              onStartDateTimeChange={handleStartDateTimeChange}
              onEndDateTimeChange={handleEndDateTimeChange}
              onApply={handleApplyDatasets}
              appliedDatasets={appliedDatasets}
            />
          </ResizablePanel>
          <div className="geo-panel">
            <MapStage startDateTime={startDateTime} endDateTime={endDateTime} appliedDatasets={appliedDatasets} onRemoveDataset={handleRemoveDataset} onAddDataset={handleAddDataset} hasExplicitRange={hasExplicitRange} onStartDateTimeChange={handleStartDateTimeChange} onEndDateTimeChange={handleEndDateTimeChange} />
          </div>
        </div>
      </main>
      
      <AppFooter />
    </div>
  );
}
