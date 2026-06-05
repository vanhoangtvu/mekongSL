import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="app-footer">
      <div className="app-footer-content">
        <div className="app-footer-links">
          <Link href="/about">About Us</Link>
          <a href="/privacy">Privacy Policy</a>
          <a href="/legal">Legal</a>
          <a href="/accessibility">Accessibility</a>
          <a href="/sitemap">Site Map</a>
          <a href="/contact">Contact</a>
        </div>
        <div className="app-footer-copyright">
          © 2026 WebGIS developed by ABC team.
        </div>
      </div>
    </footer>
  );
}
