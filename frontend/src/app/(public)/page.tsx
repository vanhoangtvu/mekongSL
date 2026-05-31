"use client";

import { useState } from "react";
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
  const [startDateTime, setStartDateTime] = useState("2026-05-01T00:00");
  const [endDateTime, setEndDateTime] = useState("2026-05-24T23:59");
  const [ecowittEnabled, setEcowittEnabled] = useState(false);

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
              onStartDateTimeChange={setStartDateTime}
              onEndDateTimeChange={setEndDateTime}
              ecowittEnabled={ecowittEnabled}
              onEcowittToggle={setEcowittEnabled}
            />
          </ResizablePanel>
          <div className="geo-panel">
            <MapStage startDateTime={startDateTime} endDateTime={endDateTime} ecowittEnabled={ecowittEnabled} />
          </div>
        </div>
      </main>
      
      <AppFooter />
    </div>
  );
}
