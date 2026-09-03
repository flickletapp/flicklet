import { ChevronLeft, Home, Compass, Plus, Trophy, User } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../theme";
import { TRENDING } from "../mockData";

// Ekranlarda tekrarlanan yükleniyor/boş/hata durumları için ortak bileşenler.
export function LoadingState({ padding = "30px 0" }) {
  return (
    <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, textAlign: "center", padding }}>Yükleniyor...</div>
  );
}

export function EmptyState({ children, padding = "30px 0", style }) {
  return (
    <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, textAlign: "center", padding, ...style }}>{children}</div>
  );
}

export function ErrorBanner({ children, style }) {
  return (
    <div
      style={{
        background: "#FDECEA",
        color: "#C0392B",
        padding: "10px 14px",
        borderRadius: 10,
        fontFamily: FONT_BODY,
        fontSize: 12.5,
        marginBottom: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PawBadge({ children, color = C.mustard }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px 5px",
        borderRadius: "14px 14px 14px 2px",
        background: color,
        color: C.cream,
        fontFamily: FONT_DISPLAY,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function BlobAvatar({ emoji, size = 48, color = C.mustard }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "42% 58% 55% 45% / 48% 42% 58% 52%",
        background: color + "22",
        border: `2px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.5,
      }}
    >
      {emoji}
    </div>
  );
}

export function PrimaryButton({ children, onClick, style, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: FONT_DISPLAY,
        fontWeight: 500,
        fontSize: 15,
        color: C.cream,
        background: disabled ? "#D8CBA8" : C.mustard,
        border: "none",
        borderRadius: 14,
        padding: "13px 20px",
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: disabled ? "none" : `0 4px 0 ${C.mustardDark}`,
        transition: "transform 0.08s ease",
        ...style,
      }}
      onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = "translateY(3px)")}
      onMouseUp={(e) => !disabled && (e.currentTarget.style.transform = "translateY(0)")}
    >
      {children}
    </button>
  );
}

export function TextField({ label, type = "text", value, onChange, placeholder }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft }}>{label}</span>
      <div style={{ position: "relative", marginTop: 6 }}>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 12,
            border: `2px solid ${C.line}`,
            fontFamily: FONT_BODY,
            fontSize: 15,
            color: C.ink,
            background: C.cream,
            outline: "none",
          }}
        />
      </div>
    </label>
  );
}

export function TopBar({ title, onBack, right }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 5,
        background: C.paper + "F2",
        backdropFilter: "blur(6px)",
        borderBottom: `1px solid ${C.line}`,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 32 }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: C.ink }}>
            <ChevronLeft size={22} />
          </button>
        )}
      </div>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.ink, fontWeight: 500 }}>{title}</div>
      <div style={{ minWidth: 32, display: "flex", justifyContent: "flex-end" }}>{right}</div>
    </div>
  );
}

export function NavBar({ tab, setTab, isGuest, onRequireAuth, onAdd }) {
  const items = [
    { key: "feed", label: "Akış", icon: Home },
    { key: "discover", label: "Keşfet", icon: Compass },
    { key: "add", label: "Ekle", icon: Plus },
    { key: "contest", label: "Yarışma", icon: Trophy },
    { key: "profile", label: "Profil", icon: User },
  ];
  return (
    <div
      className="fl-navbar"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: C.cream,
        borderTop: `1px solid ${C.line}`,
        display: "flex",
        padding: "10px 8px 14px",
      }}
    >
      {items.map((it) => {
        const Icon = it.icon;
        const active = tab === it.key;
        const isAdd = it.key === "add";
        const guestGated = isGuest && (it.key === "add" || it.key === "profile");
        return (
          <button
            key={it.key}
            onClick={() => {
              if (guestGated) return onRequireAuth();
              if (it.key === "add") return onAdd();
              setTab(it.key);
            }}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: active ? C.mustard : C.inkSoft,
            }}
          >
            {isAdd ? (
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "40% 60% 60% 40% / 45% 45% 55% 55%",
                  background: C.mustard,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -18,
                  boxShadow: `0 3px 0 ${C.mustardDark}`,
                }}
              >
                <Icon size={20} color={C.cream} />
              </div>
            ) : (
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            )}
            <span style={{ fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: active ? 800 : 600 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Genis ekranda (>=1024px) alt navigasyonun yerini alan sabit sol dikey menu.
// Sekme/guest/ekle mantigi NavBar ile birebir ayni, sadece yerlesim dikey.
export function DesktopSideNav({ tab, setTab, isGuest, onRequireAuth, onAdd }) {
  const items = [
    { key: "feed", label: "Akış", icon: Home },
    { key: "discover", label: "Keşfet", icon: Compass },
    { key: "add", label: "Ekle", icon: Plus },
    { key: "contest", label: "Yarışma", icon: Trophy },
    { key: "profile", label: "Profil", icon: User },
  ];
  return (
    <nav className="fl-sidenav">
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 21, color: C.pine, padding: "6px 14px 22px" }}>Flicklet</div>
      {items.map((it) => {
        const Icon = it.icon;
        const active = tab === it.key;
        const guestGated = isGuest && (it.key === "add" || it.key === "profile");
        return (
          <button
            key={it.key}
            onClick={() => {
              if (guestGated) return onRequireAuth();
              if (it.key === "add") return onAdd();
              setTab(it.key);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 14,
              border: "none",
              background: active ? "#FDF1D8" : "transparent",
              color: active ? C.mustard : C.ink,
              fontFamily: FONT_DISPLAY,
              fontSize: 15,
              fontWeight: active ? 600 : 500,
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
            }}
          >
            <Icon size={21} strokeWidth={active ? 2.4 : 2} />
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

// "Gündemde" bloğu — mobil/tablette Feed üstünde yatay şerit, masaüstünde
// sağ sütunda dikey liste olarak yeniden konumlanır. Veri kaynağı aynı
// (mevcut TRENDING), yeni/sahte içerik eklenmedi.
export function TrendingSection({ layout = "horizontal" }) {
  if (layout === "vertical") {
    return (
      <div style={{ background: C.cream, border: `1px solid ${C.line}`, borderRadius: 18, padding: "16px 14px" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: C.inkSoft, marginBottom: 10, display: "flex", alignItems: "center", gap: 5 }}>
          🔥 Gündemde
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {TRENDING.map((t) => (
            <div
              key={t.tag}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 2px", borderBottom: `1px solid ${C.line}` }}
            >
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: C.ink }}>{t.tag}</span>
              <span style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>{t.count} flick</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10 }}>
      {TRENDING.map((t) => (
        <div
          key={t.tag}
          style={{ whiteSpace: "nowrap", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1, padding: "8px 13px", borderRadius: 13, border: `2px solid ${C.line}`, background: C.cream, minWidth: 96 }}
        >
          <span style={{ fontFamily: FONT_DISPLAY, fontSize: 12.5, color: C.ink }}>{t.tag}</span>
          <span style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.inkSoft }}>{t.count} flick</span>
        </div>
      ))}
    </div>
  );
}
