"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

type PublicHomePanelsProps = {
  centerPanel: ReactNode;
  leftPanel: ReactNode;
  rightPanel?: ReactNode;
};

const SIDE_PANEL_WIDTH = "clamp(280px, 20vw, 360px)";
const EDGE_THRESHOLD = 24;

export function PublicHomePanels({ centerPanel, leftPanel, rightPanel }: PublicHomePanelsProps) {
  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [isLeftHovered, setIsLeftHovered] = useState(false);
  const [isRightHovered, setIsRightHovered] = useState(false);
  const [isNearScreenEdge, setIsNearScreenEdge] = useState(false);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const nearEdge =
        event.clientX <= EDGE_THRESHOLD || event.clientX >= window.innerWidth - EDGE_THRESHOLD;

      setIsNearScreenEdge(nearEdge);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  const showLeftToggle = isLeftOpen ? isLeftHovered || isNearScreenEdge : isNearScreenEdge;
  const showRightToggle = rightPanel && (isRightOpen ? isRightHovered || isNearScreenEdge : isNearScreenEdge);

  const layoutStyle = {
    "--geo-sidebar-width": isLeftOpen ? SIDE_PANEL_WIDTH : "0px",
    "--geo-results-width": rightPanel && isRightOpen ? SIDE_PANEL_WIDTH : "0px",
  } as CSSProperties;

  return (
    <section className="geo-layout" aria-label="WebGIS Interface" style={layoutStyle}>
      <div
        className={`geo-panel-shell geo-panel-shell-left ${isLeftOpen ? "is-open" : "is-collapsed"}`}
        onMouseEnter={() => setIsLeftHovered(true)}
        onMouseLeave={() => setIsLeftHovered(false)}
      >
        <button
          aria-expanded={isLeftOpen}
          aria-label={isLeftOpen ? "Hide left panel" : "Show left panel"}
          className={`geo-panel-toggle geo-panel-toggle-left ${showLeftToggle ? "is-visible" : ""}`}
          onClick={() => setIsLeftOpen((currentOpen) => !currentOpen)}
          type="button"
        >
          <span aria-hidden="true">{isLeftOpen ? "−" : "+"}</span>
        </button>
        <div className="geo-panel-shell-content">{leftPanel}</div>
      </div>

      <div className="geo-layout-center">{centerPanel}</div>

      {rightPanel && (
        <div
          className={`geo-panel-shell geo-panel-shell-right ${isRightOpen ? "is-open" : "is-collapsed"}`}
          onMouseEnter={() => setIsRightHovered(true)}
          onMouseLeave={() => setIsRightHovered(false)}
        >
          <button
            aria-expanded={isRightOpen}
            aria-label={isRightOpen ? "Hide right panel" : "Show right panel"}
            className={`geo-panel-toggle geo-panel-toggle-right ${showRightToggle ? "is-visible" : ""}`}
            onClick={() => setIsRightOpen((currentOpen) => !currentOpen)}
            type="button"
          >
            <span aria-hidden="true">{isRightOpen ? "−" : "+"}</span>
          </button>
          <div className="geo-panel-shell-content">{rightPanel}</div>
        </div>
      )}
    </section>
  );
}