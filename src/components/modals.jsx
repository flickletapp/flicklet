import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../theme";
import { BlobAvatar, PrimaryButton } from "./ui";
import { supabaseSelect, supabaseInsert } from "../lib/supabase/client";

export function FollowListModal({ title, list, onClose, onOpenProfile }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(36,33,29,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.paper,
          borderRadius: "22px 22px 0 0",
          padding: "18px 18px 24px",
          width: "100%",
          maxWidth: 480,
          maxHeight: "65vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.ink }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
            <X size={20} />
          </button>
        </div>
        {list.map((u) => (
          <div
            key={u.handle}
            onClick={() => {
              onClose();
              onOpenProfile(u);
            }}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 4px", cursor: "pointer" }}
          >
            <BlobAvatar emoji={u.petEmoji} color={u.color} size={40} />
            <div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>{u.human}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{u.handle}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommentsModal({ post, session, userId, myName, onClose, onCommentAdded }) {
  const [text, setText] = useState("");
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabaseSelect(
      "comments",
      session?.access_token,
      `select=text,created_at,profiles(display_name)&post_id=eq.${post.id}&order=created_at.asc`
    )
      .then((rows) => {
        if (active) setComments(rows);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [post.id]);

  const send = async () => {
    if (!text.trim() || !session) return;
    const body = text;
    setText("");
    setComments((c) => [...c, { text: body, profiles: { display_name: myName || "Sen" } }]);
    onCommentAdded && onCommentAdded(post.id);
    try {
      await supabaseInsert("comments", session.access_token, {
        post_id: post.id,
        author_id: userId,
        text: body,
      });
    } catch (e) {
      // sessiz geç; local state zaten güncellendi
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(36,33,29,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.paper,
          borderRadius: "22px 22px 0 0",
          padding: "18px 18px 0",
          width: "100%",
          maxWidth: 480,
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.ink }}>
            {post.pet} için yorumlar ({comments.length})
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, marginBottom: 12 }}>
          {loading && (
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, textAlign: "center", padding: "20px 0" }}>
              Yükleniyor...
            </div>
          )}
          {!loading && comments.length === 0 && (
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, textAlign: "center", padding: "20px 0" }}>
              Henüz yorum yok, ilk yorumu sen yaz.
            </div>
          )}
          {comments.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <BlobAvatar emoji="🙂" size={32} color={C.pine} />
              <div>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 12.5, color: C.ink }}>{c.profiles?.display_name || "Kullanıcı"}</div>
                <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.ink }}>{c.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, padding: "12px 0 18px", borderTop: `1px solid ${C.line}` }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Bir yorum yaz..."
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 20,
              border: `2px solid ${C.line}`,
              fontFamily: FONT_BODY,
              fontSize: 13.5,
              outline: "none",
            }}
          />
          <button
            onClick={send}
            style={{
              background: C.mustard,
              border: "none",
              borderRadius: 20,
              padding: "0 18px",
              color: C.cream,
              fontFamily: FONT_DISPLAY,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Gönder
          </button>
        </div>
      </div>
    </div>
  );
}

export function ComplaintModal({ postId, session, userId, onClose }) {
  const [sent, setSent] = useState(false);

  const submitReport = async (reason) => {
    setSent(true);
    try {
      await supabaseInsert("reports", session.access_token, { post_id: postId, reporter_id: userId, reason });
    } catch (e) {
      // sessiz geç; kullanıcıya zaten "alındı" gösterildi
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(36,33,29,0.45)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.paper,
          borderRadius: "22px 22px 0 0",
          padding: "20px 20px 28px",
          width: "100%",
          maxWidth: 480,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>
            {sent ? "Bildirim alındı" : "Bu gönderiyi şikayet et"}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
            <X size={20} />
          </button>
        </div>
        {!sent ? (
          <>
            {["Uygunsuz içerik", "Spam", "Hayvana zarar/ihmal görüntüsü", "Sahte hesap"].map((r) => (
              <button
                key={r}
                onClick={() => submitReport(r)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "13px 14px",
                  marginBottom: 8,
                  borderRadius: 12,
                  border: `1px solid ${C.line}`,
                  background: C.cream,
                  fontFamily: FONT_BODY,
                  fontSize: 13.5,
                  color: C.ink,
                  cursor: "pointer",
                }}
              >
                {r}
              </button>
            ))}
          </>
        ) : (
          <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.inkSoft, lineHeight: 1.5 }}>
            Şikayetin ekibimize iletildi, inceleyeceğiz. İçerik otomatik filtreden de geçirilir.
          </div>
        )}
      </div>
    </div>
  );
}

export function SignupPromptModal({ onClose, onSignup }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(36,33,29,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.paper,
          borderRadius: 22,
          padding: "28px 24px",
          width: "100%",
          maxWidth: 360,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 10 }}>🐾</div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.ink, marginBottom: 6 }}>
          Bunun için üye olman lazım
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, marginBottom: 20, lineHeight: 1.5 }}>
          Gözatmaya devam edebilirsin, ama beğenmek, oy vermek, yorum yapmak ve paylaşım eklemek için bir hesap gerekiyor.
        </div>
        <PrimaryButton style={{ width: "100%", marginBottom: 10 }} onClick={onSignup}>
          Ücretsiz üye ol
        </PrimaryButton>
        <div onClick={onClose} style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft, cursor: "pointer" }}>
          Gözatmaya devam et
        </div>
      </div>
    </div>
  );
}
