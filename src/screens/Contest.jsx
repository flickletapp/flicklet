import { useEffect, useState } from "react";
import { Award, Sparkles } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../theme";
import { TopBar, BlobAvatar } from "../components/ui";
import { CATEGORIES, CATEGORY_SUGGESTIONS } from "../mockData";
import { supabaseSelect } from "../lib/supabaseClient";

async function loadLeaderboard(session, category) {
  const rows = await supabaseSelect(
    "posts",
    session?.access_token,
    `select=id,profiles!posts_author_id_fkey(display_name),pets(name,emoji)&contest_category=eq.${encodeURIComponent(category)}`
  );
  const postIds = rows.map((r) => r.id);
  let voteRows = [];
  if (postIds.length > 0) {
    voteRows = await supabaseSelect("contest_votes", session?.access_token, `select=post_id&post_id=in.(${postIds.join(",")})`);
  }
  return rows
    .map((r) => ({
      id: r.id,
      pet: r.pets?.name || "Dost",
      emoji: r.pets?.emoji || "🐾",
      human: r.profiles?.display_name || "Kullanıcı",
      votes: voteRows.filter((v) => v.post_id === r.id).length,
    }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 10);
}

// Not: "Gelecek Ay İçin Öner" sekmesi henüz mock veriyle çalışıyor — ayrı bir işte gerçek veriye bağlanacak.
export function ContestScreen({ session }) {
  const [activeCat, setActiveCat] = useState(CATEGORIES[0]);
  const [view, setView] = useState("leaderboard"); // leaderboard | suggest
  const [suggestions, setSuggestions] = useState(CATEGORY_SUGGESTIONS);
  const [voted, setVoted] = useState({});
  const [newIdea, setNewIdea] = useState("");
  const [board, setBoard] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingBoard(true);
    loadLeaderboard(session, activeCat)
      .then((rows) => active && setBoard(rows))
      .catch(() => active && setBoard([]))
      .finally(() => active && setLoadingBoard(false));
    return () => {
      active = false;
    };
  }, [activeCat]);

  const voteFor = (id) => {
    if (voted[id]) return;
    setSuggestions((s) => s.map((c) => (c.id === id ? { ...c, votes: c.votes + 1 } : c)));
    setVoted((v) => ({ ...v, [id]: true }));
  };

  const addSuggestion = () => {
    if (!newIdea.trim()) return;
    setSuggestions((s) => [...s, { id: Date.now(), name: newIdea, votes: 1 }]);
    setVoted((v) => ({ ...v, [Date.now()]: true }));
    setNewIdea("");
  };

  return (
    <div>
      <TopBar title="Yarışma" />
      <div style={{ padding: "14px 14px 0", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, background: C.cream, borderRadius: 13, padding: 4, border: `1px solid ${C.line}` }}>
          {[
            { key: "leaderboard", label: "Bu Ay" },
            { key: "suggest", label: "Gelecek Ay İçin Öner" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              style={{
                flex: 1,
                padding: "9px 8px",
                borderRadius: 10,
                border: "none",
                background: view === t.key ? C.mustard : "transparent",
                color: view === t.key ? C.cream : C.inkSoft,
                fontFamily: FONT_DISPLAY,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {view === "leaderboard" && (
        <div style={{ padding: "0 14px 90px", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 18 }}>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCat(c)}
                style={{
                  whiteSpace: "nowrap",
                  padding: "9px 14px",
                  borderRadius: 12,
                  border: `2px solid ${activeCat === c ? C.mustard : C.line}`,
                  background: activeCat === c ? "#FDF1D8" : C.cream,
                  fontFamily: FONT_DISPLAY,
                  fontSize: 12.5,
                  color: C.ink,
                  cursor: "pointer",
                }}
              >
                {c}
              </button>
            ))}
          </div>

          <div style={{ background: `linear-gradient(135deg, ${C.pine}, #0f3a30)`, borderRadius: 20, padding: "20px 18px", color: C.cream, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Award size={18} />
              <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14 }}>Ay sonuna 6 gün kaldı</span>
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, opacity: 0.85, lineHeight: 1.5 }}>
              Ayın her günü oy kullanırsan "Sadık Oy Veren" rozetini kazanırsın.
            </div>
          </div>

          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 15, color: C.ink, marginBottom: 10 }}>Sıralama — {activeCat}</div>
          {loadingBoard && (
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, textAlign: "center", padding: "20px 0" }}>Yükleniyor...</div>
          )}
          {!loadingBoard && board.length === 0 && (
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, textAlign: "center", padding: "20px 0" }}>
              Bu kategoride henüz gönderi yok.
            </div>
          )}
          {board.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 14px", marginBottom: 8 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, width: 24, textAlign: "center", color: i === 0 ? C.mustard : C.inkSoft }}>{i + 1}</div>
              <BlobAvatar emoji={r.emoji} size={38} color={i === 0 ? C.mustard : C.pine} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>{r.pet}</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{r.human}</div>
              </div>
              <div style={{ fontFamily: FONT_BODY, fontWeight: 800, fontSize: 13, color: C.pine }}>{r.votes} oy</div>
            </div>
          ))}
        </div>
      )}

      {view === "suggest" && (
        <div style={{ padding: "0 14px 90px", maxWidth: 480, margin: "0 auto" }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft, marginBottom: 16, lineHeight: 1.5 }}>
            Gelecek ayın yarışma kategorilerini topluluk seçiyor. En çok oy alan 4 kategori bir sonraki aya taşınır.
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <input
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSuggestion()}
              placeholder="Yeni kategori öner..."
              style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: `2px solid ${C.line}`, fontFamily: FONT_BODY, fontSize: 13, outline: "none" }}
            />
            <button onClick={addSuggestion} style={{ background: C.mustard, border: "none", borderRadius: 12, padding: "0 16px", color: C.cream, fontFamily: FONT_DISPLAY, fontSize: 13, cursor: "pointer" }}>
              Öner
            </button>
          </div>

          {suggestions
            .slice()
            .sort((a, b) => b.votes - a.votes)
            .map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
                {i < 4 && <Sparkles size={15} color={C.mustard} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>{s.name}</div>
                  {i < 4 && <div style={{ fontFamily: FONT_BODY, fontSize: 10.5, color: C.mustardDark }}>Şu an kazanıyor</div>}
                </div>
                <button
                  onClick={() => voteFor(s.id)}
                  disabled={voted[s.id]}
                  style={{
                    background: voted[s.id] ? "#EFEAE0" : C.pine,
                    color: voted[s.id] ? C.inkSoft : C.cream,
                    border: "none",
                    borderRadius: 10,
                    padding: "7px 12px",
                    fontFamily: FONT_DISPLAY,
                    fontSize: 12,
                    cursor: voted[s.id] ? "default" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {voted[s.id] ? "Oylandı" : `Oy Ver · ${s.votes}`}
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
