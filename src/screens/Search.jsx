import { useState } from "react";
import { C, FONT_DISPLAY, FONT_BODY } from "../theme";
import { TopBar, BlobAvatar } from "../components/ui";
import { MOCK_USERS } from "../mockData";

// Not: Bu ekran henüz mock veriyle çalışıyor — Faz B'de gerçek profil aramasına bağlanacak.
export function SearchScreen({ onBack, onOpenProfile }) {
  const [q, setQ] = useState("");
  const results = q.trim()
    ? MOCK_USERS.filter((u) => u.handle.toLowerCase().includes(q.toLowerCase().replace("@", "")) || u.human.toLowerCase().includes(q.toLowerCase()))
    : [];

  return (
    <div>
      <TopBar title="Ara" onBack={onBack} />
      <div style={{ padding: "14px 18px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ position: "relative", marginBottom: 18 }}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="@kullaniciadi veya isim ara"
            style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 14, border: `2px solid ${C.line}`, fontFamily: FONT_BODY, fontSize: 14, color: C.ink, background: C.cream, outline: "none" }}
          />
        </div>

        {!q && (
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, textAlign: "center", padding: "30px 0" }}>
            Bir kullanıcı adı yazmaya başla 🔍
          </div>
        )}

        {q && results.length === 0 && (
          <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, textAlign: "center", padding: "30px 0" }}>
            "{q}" ile eşleşen kimse bulunamadı.
          </div>
        )}

        {results.map((u) => (
          <div key={u.handle} onClick={() => onOpenProfile(u)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderRadius: 14, cursor: "pointer" }}>
            <BlobAvatar emoji={u.petEmoji} color={u.color} size={44} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink }}>{u.human}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>{u.handle} · {u.pet} ile birlikte</div>
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{u.followers} takipçi</div>
          </div>
        ))}
      </div>
    </div>
  );
}
