import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, Home, Compass, Plus, Trophy, User } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../theme";
import { TRENDING } from "../mockData";
import { resolveImageUrl, getCachedImageExpiry, IMAGE_PROACTIVE_REFRESH_MARGIN_MS } from "../lib/supabase/client";

// Bu pay client.js'ten geliyor ve KASITLI olarak resolveImageUrl'in kendi
// onbellek-tazelik esiginden (IMAGE_STALE_MARGIN_MS) KUCUK - aksi halde
// asagidaki proaktif cagri "zaten taze" sanilip ayni (suresi dolmak
// uzere olan) URL'i geri alir ve sifir-gecikmeli bir yeniden deneme
// donguesune donusur (bkz. client.js'teki aciklama).
const REFRESH_MARGIN_MS = IMAGE_PROACTIVE_REFRESH_MARGIN_MS;

// Ortak gorsel cozumleme katmani - TUM ekranlar image_url/avatar_url'i
// DOGRUDAN <img src> olarak KULLANMAMALI (bkz. 016_post_images_private_access
// migration - bucket private, DB'de bare path tutuluyor). Bu bilesen:
//   - path'i imzali URL'e cozer (resolveImageUrl - istek birlestirme ve
//     kullanici-bazli onbellek ORADA yapiliyor, burada tekrarlanmiyor);
//   - GORUNUR haldeyken suresi dolmadan ONCEDEN kendini yeniler (sadece
//     img.onError'a guvenmez - onError ancak tarayici gercekten yuklemeyi
//     DENEYIP basarisiz oldugunda tetiklenir, bu da kullaniciya kirik
//     gorsel gostermek anlamina gelebilir);
//   - sekme arka plandan one geldiginde (visibilitychange) suresi kontrol
//     edip gerekirse yeniler;
//   - bilesen kaldirildiginda TUM zamanlayicilari/listener'lari temizler;
//   - erisim REDDEDILIRSE (resolve reddi - ör. engellenme/gizlilik
//     degisikligi) eski gorseli EKRANDA BIRAKMAZ - src hemen temizlenip
//     fallback'e geciliyor;
//   - en fazla `maxRetries` kez img.onError ile dener, sonra sabit bir
//     fallback'e duser (sonsuz donguye girmez).
export function ResolvedImage({ path, kind = "post", session, userId, alt = "", style, fallback = null, maxRetries = 2 }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const retriesRef = useRef(0);
  const refreshTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const accessToken = session?.access_token;

  const clearRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  const scheduleProactiveRefresh = useCallback(
    (forPath) => {
      clearRefreshTimer();
      const expiresAt = getCachedImageExpiry(forPath);
      if (!expiresAt) return;
      const delay = Math.max(expiresAt - Date.now() - REFRESH_MARGIN_MS, 1000);
      refreshTimerRef.current = setTimeout(() => {
        if (mountedRef.current) load();
      }, delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const load = useCallback(() => {
    if (!path) {
      setSrc(null);
      setFailed(false);
      return;
    }
    resolveImageUrl(path, kind, accessToken, userId)
      .then((url) => {
        if (!mountedRef.current) return;
        setSrc(url);
        setFailed(false);
        scheduleProactiveRefresh(path);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        // Erisim reddedildi/hata olustu - ESKI gorseli EKRANDA BIRAKMA,
        // uygun bos/hata durumuna gec.
        setSrc(null);
        setFailed(true);
        clearRefreshTimer();
      });
  }, [path, kind, accessToken, userId, scheduleProactiveRefresh]);

  useEffect(() => {
    mountedRef.current = true;
    retriesRef.current = 0;
    setFailed(false);
    load();
    return () => {
      mountedRef.current = false;
      clearRefreshTimer();
    };
  }, [load]);

  // Sekme arka plandan one geldiginde suresi dolmus/dolmak uzere olan
  // gorselleri yenile - sadece zamanlayiciya guvenme (arka plandayken
  // setTimeout duraklatilmis/gecikmis olabilir).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !path) return;
      const expiresAt = getCachedImageExpiry(path);
      if (!expiresAt || expiresAt - Date.now() < REFRESH_MARGIN_MS) {
        load();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [path, load]);

  const handleError = () => {
    if (retriesRef.current >= maxRetries) {
      setSrc(null);
      setFailed(true);
      return;
    }
    retriesRef.current += 1;
    load();
  };

  if (!path || failed) return fallback;
  if (!src) return null;
  return <img src={src} alt={alt} style={style} onError={handleError} />;
}

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

export function PrimaryButton({ children, onClick, style, disabled, type = "button" }) {
  return (
    <button
      type={type}
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

// Kullanici adi alani: kullanici "@" YAZMAZ, arayuz gorsel olarak
// solda sabit bir "@" gosterir (input value'suna dahil degil).
export function UsernameField({ label = "Kullanıcı adı", value, onChange, placeholder, hint }) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft }}>{label}</span>
      <div style={{ position: "relative", marginTop: 6 }}>
        <span
          style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            fontFamily: FONT_BODY,
            fontSize: 15,
            color: C.inkSoft,
            pointerEvents: "none",
          }}
        >
          @
        </span>
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 14px 12px 26px",
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
      {hint && (
        <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, marginTop: 5, lineHeight: 1.4 }}>{hint}</div>
      )}
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

// Tek marka standardı: TopBar'daki mevcut "Flicklet" görünümü (FONT_DISPLAY,
// 500 kalınlık, C.pine rengi). Sadece boyut (size) bağlama göre değişir -
// yazı karakteri/kalınlık/renk her yerde birebir aynı kalır.
export function FlickletLogo({ size = 18, className, style }) {
  return (
    <span className={className} style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: size, color: C.pine, ...style }}>
      Flicklet
    </span>
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
      {/* Amblem konumu: ust cubuga yapismamasi icin ustte nefes alani,
          "Akis" satiriyla arasinda dengeli bosluk. Yatayda hesap, PNG'nin
          seffaf tuvaline gore degil GORUNEN sekle gore yapiliyor: dosyada
          her yonde ~%8 seffaf pay var, yani 52 px'te gorunen amblem
          kenardan ~4 px iceride basliyor. Bu yuzden padding-left, o 4 px
          dusulerek secildi (gorunen sol kenar nav ikonlarindan ~10 px
          saga gelsin diye). Boyut (52x52) ve dosya degismedi. */}
      <div style={{ padding: "22px 14px 26px 20px" }}>
        {/* Amblem = ana akisa donus. "Akis" satiriyla AYNI yontem
            (setTab("feed")) kullaniliyor, ikinci bir navigasyon sistemi
            yok. "feed" sekmesi misafirde de acik oldugu icin (NavBar ile
            ayni kural) giris penceresi acilmiyor. Zaten akistaysak sekme
            degistirilmiyor, sadece en uste kaydiriliyor. <button>
            oldugu icin Enter ve Space kendiliginden calisiyor;
            gorsel tepki sadece hafif opaklik (sekil/renk degismiyor). */}
        <button
          type="button"
          className="fl-logo-btn"
          aria-label="Ana akışa git"
          onClick={() => {
            if (tab !== "feed") {
              setTab("feed");
              return;
            }
            // Zaten akistayiz: sayfa yenilenmiyor, sadece en uste kaydiriliyor.
            const before = window.scrollY;
            if (before === 0) return;
            window.scrollTo({ top: 0, behavior: "smooth" });
            // Bazi ortamlar/ayarlar yumusak kaydirmayi sessizce yok
            // sayiyor; kisa bir sure sonra hic hareket olmadiysa aninda
            // en uste al ki davranis her yerde garanti olsun.
            window.setTimeout(() => {
              if (window.scrollY === before) window.scrollTo(0, 0);
            }, 80);
          }}
        >
          <img src="/flicklet-mark.png" alt="" style={{ width: 52, height: 52, display: "block" }} />
        </button>
      </div>
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
