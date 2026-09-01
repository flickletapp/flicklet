import { useState } from "react";
import { Send } from "lucide-react";
import { C, FONT_BODY } from "../theme";
import { TopBar, BlobAvatar } from "../components/ui";

// Not: Bu ekran henüz mock veriyle çalışıyor — Faz C'de gerçek zamanlı DM'e bağlanacak.
export function ChatScreen({ conversation, onBack }) {
  const [messages, setMessages] = useState(conversation.messages);
  const [text, setText] = useState("");

  const send = () => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { from: "me", text }]);
    setText("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <TopBar title={conversation.human} onBack={onBack} right={<BlobAvatar emoji={conversation.petEmoji} size={30} color={conversation.color} />} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", maxWidth: 480, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.from === "me" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div
              style={{
                maxWidth: "75%",
                padding: "10px 14px",
                borderRadius: m.from === "me" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: m.from === "me" ? C.mustard : C.cream,
                color: m.from === "me" ? C.cream : C.ink,
                border: m.from === "me" ? "none" : `1px solid ${C.line}`,
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
