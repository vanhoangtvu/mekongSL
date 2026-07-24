"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const FOOTER_LINKS = [
  { href: "/about", label: "About Us" },
  { href: "/news", label: "News" },
  { href: "/download", label: "Download" },
  { href: "/privacy", label: "Privacy" },
  { href: "/policy", label: "Policy" },
  { href: "/sitemap", label: "Site Map" },
];

export function AppFooter() {
  const [showAll, setShowAll] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const visibleLinks = isMobile && !showAll ? FOOTER_LINKS.slice(0, 2) : FOOTER_LINKS;

  return (
    <footer className="app-footer">
      <div className="app-footer-content">
        <div className="app-footer-links">
          {visibleLinks.map((link) => (
            <Link key={link.href} href={link.href}>{link.label}</Link>
          ))}
          {isMobile && !showAll && (
            <button className="footer-show-more" onClick={() => setShowAll(true)} type="button">
              Xem thêm
            </button>
          )}
          {isMobile && showAll && (
            <button className="footer-show-more" onClick={() => setShowAll(false)} type="button">
              Thu gọn
            </button>
          )}
        </div>
        <div className="app-footer-copyright">
          © 2026 WebGIS developed by MSL.
        </div>
      </div>
    </footer>
  );
}
