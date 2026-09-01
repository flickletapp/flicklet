import { C, FONT_DISPLAY, FONT_BODY } from "../theme";
import { TopBar, BlobAvatar } from "../components/ui";
import { CONVERSATIONS } from "../mockData";

// Not: Bu ekran henüz mock veriyle çalışıyor — Faz C'de gerçek zamanlı DM'e bağlanacak.
export function InboxScreen({ onBack, onOpenChat }) {
  return (
    <div>
      <TopBar title="Mesajlar" onBack={onBack} />
      <div style={{ padding: "8px 10px", maxWidth: 480, margin: "0 auto" }}>
        {CONVERSATIONS.map((c) => (
          <div key={c.id} onClick={() => onOpenChat(c)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 10px", borderRadius: 14, cursor: "pointer" }}>
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
        {CONVERSATIONS.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>Henüz bir mesajın yok.</div>
        )}
      </div>
    </div>
  );
}
