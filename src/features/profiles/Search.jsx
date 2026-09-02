import { useEffect, useState } from "react";
import { C, FONT_DISPLAY, FONT_BODY } from "../../theme";
import { TopBar, BlobAvatar, EmptyState } from "../../components/ui";
import { supabaseSelect } from "../../lib/supabase/client";

async function searchUsers(session, query) {
  const term = query.trim().replace(/^@/, "");
  if (!term) return [];
  const encoded = encodeURIComponent(term);
  const rows = await supabaseSelect(
    "profiles",
    session?.access_token,
    `select=id,handle,display_name&or=(handle.ilike.*${encoded}*,display_name.ilike.*${encoded}*)&limit=20`
  );
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const pets = await supabaseSelect("pets", session?.access_token, `select=owner_id,name,emoji&owner_id=in.(${ids.join(",")})`);
  return rows.map((r) => {
    const pet = pets.find((p) => p.owner_id === r.id);
    return {
      authorId: r.id,
      handle: r.handle,
      human: r.display_name || "Kullanıcı",
      pet: pet?.name || "Dost",
      petEmoji: pet?.emoji || "🐾",
    };
  });
}

export function SearchScreen({ session, onBack, onOpenProfile }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      searchUsers(session, q)
        .then((rows) => active && setResults(rows))
        .catch(() => active && setResults([]))
        .finally(() => active && setLoading(false));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);

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

        {!q && <EmptyState>Bir kullanıcı adı yazmaya başla 🔍</EmptyState>}

        {q && loading && <EmptyState>Aranıyor...</EmptyState>}

        {q && !loading && results.length === 0 && <EmptyState>"{q}" ile eşleşen kimse bulunamadı.</EmptyState>}

        {results.map((u) => (
          <div key={u.authorId} onClick={() => onOpenProfile(u)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 8px", borderRadius: 14, cursor: "pointer" }}>
            <BlobAvatar emoji={u.petEmoji} color={C.mustard} size={44} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink }}>{u.human}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>{u.handle} · {u.pet} ile birlikte</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
