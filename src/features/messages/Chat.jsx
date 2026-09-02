import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { C, FONT_BODY } from "../../theme";
import { TopBar, BlobAvatar, LoadingState, EmptyState } from "../../components/ui";
import { supabaseSelect, supabaseInsert, supabaseUpdate } from "../../lib/supabase/client";

export function ChatScreen({ conversation, session, userId, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    let active = true;
    supabaseSelect(
      "messages",
      session?.access_token,
      `select=id,sender_id,text,created_at&or=(and(sender_id.eq.${userId},recipient_id.eq.${conversation.targetId}),and(sender_id.eq.${conversation.targetId},recipient_id.eq.${userId}))&order=created_at.asc`
    )
      .then((rows) => active && setMessages(rows))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    supabaseUpdate(
      "messages",
      session?.access_token,
      `recipient_id=eq.${userId}&sender_id=eq.${conversation.targetId}&read=eq.false`,
      { read: true }
    ).catch(() => {});
    return () => {
      active = false;
    };
  }, [conversation.targetId]);

  const send = async () => {
    if (!text.trim()) return;
    const body = text;
    setText("");
    setError("");
    try {
      const inserted = await supabaseInsert("messages", session.access_token, {
        sender_id: userId,
        recipient_id: conversation.targetId,
        text: body,
      });
      setMessages((m) => [...m, inserted[0]]);
    } catch (e) {
      setError("Mesaj gönderilemedi — bu kişi sadece takipçilerinden mesaj alıyor olabilir.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar title={conversation.human} onBack={onBack} right={<BlobAvatar emoji={conversation.petEmoji} size={30} color={conversation.color} />} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", maxWidth: 480, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {loading && <LoadingState padding="20px 0" />}
        {!loading && messages.length === 0 && <EmptyState padding="20px 0">Henüz mesaj yok, ilk mesajı sen yaz.</EmptyState>}
        {messages.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.sender_id === userId ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div
              style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius: m.sender_id === userId ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: m.sender_id === userId ? C.mustard : C.cream,
                color: m.sender_id === userId ? C.cream : C.ink,
                border: m.sender_id === userId ? "none" : `1px solid ${C.line}`,
                fontFamily: FONT_BODY,
                fontSize: 13.5,
                lineHeight: 1.4,
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>
      {error && (
        <div style={{ padding: "0 14px 8px", maxWidth: 480, margin: "0 auto", width: "100%", boxSizing: "border-box", fontFamily: FONT_BODY, fontSize: 12, color: C.coral }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, padding: "10px 14px 18px", borderTop: `1px solid ${C.line}`, maxWidth: 480, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Bir mesaj yaz..."
          style={{ flex: 1, padding: "11px 14px", borderRadius: 20, border: `2px solid ${C.line}`, fontFamily: FONT_BODY, fontSize: 13.5, outline: "none" }}
        />
        <button onClick={send} style={{ background: C.mustard, border: "none", borderRadius: "50%", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: C.cream, cursor: "pointer", flexShrink: 0 }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
