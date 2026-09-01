import { useEffect, useState } from "react";
import { C, FONT_DISPLAY, FONT_BODY } from "../theme";
import { TopBar, BlobAvatar } from "../components/ui";
import { supabaseSelect } from "../lib/supabase/client";

async function loadConversations(session, userId) {
  const rows = await supabaseSelect(
    "messages",
    session?.access_token,
    `select=id,sender_id,recipient_id,text,created_at,read&or=(sender_id.eq.${userId},recipient_id.eq.${userId})&order=created_at.desc`
  );
  const byOther = new Map();
  for (const m of rows) {
    const otherId = m.sender_id === userId ? m.recipient_id : m.sender_id;
    if (!byOther.has(otherId)) byOther.set(otherId, { lastMessage: m, unread: false });
    if (m.recipient_id === userId && !m.read) byOther.get(otherId).unread = true;
  }
  const otherIds = [...byOther.keys()];
  if (otherIds.length === 0) return [];
  const [profiles, pets] = await Promise.all([
    supabaseSelect("profiles", session?.access_token, `select=id,handle,display_name&id=in.(${otherIds.join(",")})`),
    supabaseSelect("pets", session?.access_token, `select=owner_id,name,emoji&owner_id=in.(${otherIds.join(",")})`),
  ]);
  return otherIds
    .map((id) => {
      const p = profiles.find((x) => x.id === id);
      const pet = pets.find((x) => x.owner_id === id);
      const conv = byOther.get(id);
      return {
        targetId: id,
        handle: p?.handle || "",
        human: p?.display_name || "Kullanıcı",
        petEmoji: pet?.emoji || "🐾",
        color: C.mustard,
        lastMessage: conv.lastMessage.text,
        unread: conv.unread,
        lastAt: conv.lastMessage.created_at,
      };
    })
    .sort((a, b) => new Date(b.lastAt) - new Date(a.lastAt));
}

export function InboxScreen({ session, userId, onBack, onOpenChat }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadConversations(session, userId)
      .then((rows) => active && setConversations(rows))
      .catch(() => active && setConversations([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <div>
      <TopBar title="Mesajlar" onBack={onBack} />
      <div style={{ padding: "8px 10px", maxWidth: 480, margin: "0 auto" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 20px", fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>Yükleniyor...</div>
        )}
        {!loading &&
          conversations.map((c) => (
            <div key={c.targetId} onClick={() => onOpenChat(c)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 10px", borderRadius: 14, cursor: "pointer" }}>
              <BlobAvatar emoji={c.petEmoji} color={c.color} size={46} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink }}>{c.human}</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: c.unread ? C.ink : C.inkSoft, fontWeight: c.unread ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.lastMessage}
                </div>
              </div>
              {c.unread && <div style={{ width: 9, height: 9, borderRadius: "50%", background: C.coral, flexShrink: 0 }} />}
            </div>
          ))}
        {!loading && conversations.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>Henüz bir mesajın yok.</div>
        )}
      </div>
    </div>
  );
}
