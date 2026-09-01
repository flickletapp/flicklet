import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../theme";
import { TopBar } from "../components/ui";
import { CATEGORIES } from "../mockData";
import { loadFeed, PostCard } from "./Feed";

const DISCOVER_FILTERS = ["Tümü", "En Beğenilenler", ...CATEGORIES];

export function DiscoverScreen({ session, userId, myName, onOpenProfile, onOpenComplaint, isGuest, onRequireAuth, refreshKey }) {
  const [filter, setFilter] = useState("Tümü");
  const [openPost, setOpenPost] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadFeed(session, userId)
      .then((rows) => active && setPosts(rows))
      .catch((e) => console.error(e))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [refreshKey, userId]);

  const scored = posts.filter((p) => p.imageUrl).sort((a, b) => b.likeCount - a.likeCount);
  const shown =
    filter === "Tümü" ? scored : filter === "En Beğenilenler" ? scored.slice(0, 4) : scored.filter((p) => p.contest === filter);

  if (openPost) {
    return (
      <div>
        <TopBar title={openPost.pet} onBack={() => setOpenPost(null)} />
        <div style={{ padding: "16px 14px 40px", maxWidth: 480, margin: "0 auto" }}>
          <PostCard
            post={openPost}
            session={session}
            userId={userId}
            myName={myName}
            onOpenComplaint={isGuest ? onRequireAuth : onOpenComplaint}
            onOpenProfile={onOpenProfile}
            isGuest={isGuest}
            onRequireAuth={onRequireAuth}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Keşfet" />
      <div style={{ padding: "12px 14px 0", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12 }}>
          {DISCOVER_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                whiteSpace: "nowrap",
                padding: "8px 13px",
                borderRadius: 12,
                border: `2px solid ${filter === f ? C.mustard : C.line}`,
                background: filter === f ? "#FDF1D8" : C.cream,
                fontFamily: FONT_DISPLAY,
                fontSize: 12,
                color: C.ink,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, textAlign: "center", padding: "30px 0" }}>Yükleniyor...</div>
      )}

      <div style={{ padding: "0 10px 90px", maxWidth: 480, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {shown.map((p) => (
          <div
            key={p.id}
            onClick={() => setOpenPost(p)}
            style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden", cursor: "pointer" }}
          >
            <img src={p.imageUrl} alt={p.caption} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {p.contest && <div style={{ position: "absolute", top: 5, right: 5, fontSize: 13 }}>🏆</div>}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent, rgba(0,0,0,0.45))", padding: "16px 6px 5px", display: "flex", alignItems: "center", gap: 3 }}>
              <Heart size={10} color="#fff" fill="#fff" />
              <span style={{ fontFamily: FONT_BODY, fontSize: 10, color: "#fff", fontWeight: 700 }}>{p.likeCount}</span>
            </div>
          </div>
        ))}
        {!loading && shown.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 0", fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>
            Bu filtrede henüz gönderi yok.
          </div>
        )}
      </div>
    </div>
  );
}
