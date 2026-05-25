"use client";

import { useEffect, useRef, useState } from "react";

type ThemeMode = "dark" | "light";
type FontSize = "sm" | "md" | "lg";

const THEME_STORAGE_KEY = "eva-webgis-theme";
const FONT_SIZE_STORAGE_KEY = "eva-webgis-font-size";

const themeOptions: Array<{ value: ThemeMode; label: string; description: string }> = [
  { value: "light", label: "Sáng", description: "Nền sáng, chữ đậm" },
  { value: "dark", label: "Tối", description: "Nền tối, tương phản cao" },
];

const fontSizeOptions: Array<{ value: FontSize; label: string; description: string }> = [
  { value: "sm", label: "Nhỏ", description: "Chữ gọn hơn" },
  { value: "md", label: "Vừa", description: "Mặc định" },
  { value: "lg", label: "Lớn", description: "Dễ đọc hơn" },
];

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function applyFontSize(fontSize: FontSize) {
  const root = document.documentElement;
  root.dataset.fontSize = fontSize;
  window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSize);
}

export function GeoDisplaySettings() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const storedFontSize = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);

    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
      applyTheme(storedTheme);
    }

    if (storedFontSize === "sm" || storedFontSize === "md" || storedFontSize === "lg") {
      setFontSize(storedFontSize);
      applyFontSize(storedFontSize);
    }
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="geo-settings" ref={settingsRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Cài đặt giao diện"
        className="geo-settings-trigger"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        type="button"
      >
        <span aria-hidden="true">⚙</span>
      </button>

      {open ? (
        <div aria-label="Bảng cài đặt giao diện" className="geo-settings-panel" role="dialog">
          <section className="geo-settings-group">
            <div className="geo-settings-group-head">
              <h3>Chủ đề</h3>
              <span>{theme === "light" ? "Sáng" : "Tối"}</span>
            </div>

            <div className="geo-settings-options" role="group" aria-label="Chọn chủ đề giao diện">
              {themeOptions.map((option) => (
                <button
                  className={`geo-settings-option ${theme === option.value ? "is-active" : ""}`}
                  key={option.value}
                  onClick={() => {
                    setTheme(option.value);
                    applyTheme(option.value);
                  }}
                  type="button"
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="geo-settings-group">
            <div className="geo-settings-group-head">
              <h3>Cỡ chữ</h3>
              <span>{fontSize === "sm" ? "Nhỏ" : fontSize === "lg" ? "Lớn" : "Vừa"}</span>
            </div>

            <div className="geo-settings-options geo-settings-options-font" role="group" aria-label="Chọn cỡ chữ">
              {fontSizeOptions.map((option) => (
                <button
                  className={`geo-settings-option ${fontSize === option.value ? "is-active" : ""}`}
                  key={option.value}
                  onClick={() => {
                    setFontSize(option.value);
                    applyFontSize(option.value);
                  }}
                  type="button"
                >
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </button>
              ))}
            </div>
          </section>

          <p className="geo-settings-note">Cài đặt được lưu trên trình duyệt của bạn.</p>
        </div>
      ) : null}
    </div>
  );
}