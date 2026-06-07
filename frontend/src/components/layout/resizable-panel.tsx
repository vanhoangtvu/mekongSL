"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

type ResizablePanelProps = {
  children: ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  side?: "left" | "right";
  isMobile?: boolean;
  isSidebarOpen?: boolean;
  onClose?: () => void;
};

export function ResizablePanel({
  children,
  defaultWidth = 360,
  minWidth = 280,
  maxWidth = 600,
  side = "left",
  isMobile,
  isSidebarOpen,
  onClose,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;

      const rect = panelRef.current.getBoundingClientRect();
      let newWidth: number;

      if (side === "left") {
        newWidth = e.clientX - rect.left;
      } else {
        newWidth = rect.right - e.clientX;
      }

      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minWidth, maxWidth, side]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  if (isMobile) {
    return (
      <>
        {isSidebarOpen && <div className="sidebar-backdrop" onClick={onClose} />}
        <div
          ref={panelRef}
          className={`resizable-panel mobile-drawer ${isSidebarOpen ? 'mobile-drawer--open' : ''}`}
          style={{ width: `${Math.min(width, window.innerWidth - 48)}px` }}
        >
          {children}
        </div>
      </>
    );
  }

  return (
    <div
      ref={panelRef}
      className="resizable-panel"
      style={{ width: `${width}px` }}
    >
      {children}
      <div
        className={`resize-handle resize-handle-${side} ${isDragging ? "is-dragging" : ""}`}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
