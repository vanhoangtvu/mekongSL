"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "../../components/layout/app-header";
import { AppFooter } from "../../components/layout/app-footer";
import { SearchTabs, GeoSearchSidebar } from "../../components/layout/geo-search-sidebar";
import { ResizablePanel } from "../../components/layout/resizable-panel";
import { MapStage } from "../../components/map/map-stage";

type TabType = "criteria" | "datasets" | "additional" | "results";

export default function PublicHomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("criteria");

  return (
    <div className="app-container public-home">
      <AppHeader />
      
      <main className="app-main">
        <SearchTabs activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="app-content">
          <ResizablePanel defaultWidth={360} minWidth={280} maxWidth={600} side="left">
            <GeoSearchSidebar activeTab={activeTab} onTabChange={setActiveTab} />
          </ResizablePanel>
          <div className="geo-panel">
            <MapStage />
          </div>
        </div>
      </main>
      
      <AppFooter />
    </div>
  );
}
