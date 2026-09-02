import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../../theme";
import { TopBar, BlobAvatar } from "../../components/ui";
import { FollowListModal } from "../../components/modals";
import { MOCK_FOLLOWERS } from "../../mockData";
import { supabaseSelect, supabaseInsert, supabaseDelete, supabaseCount } from "../../lib/supabase/client";

export function UserProfileView({ target, session, userId, onBack, onOpenProfile, onOpenChat, isGuest, onRequireAuth }) {
  // followState: "none" | "pending" | "following" - kapali profillerde
  // dogrudan follows yerine follow_requests (pet_id=null) akisi kullanilir.
  const [followState, setFollowState] = useState("none");
  const [targetIsPrivate, setTargetIsPrivate] = useState(null);
  const [listOpen, setListOpen] = useState(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const isSelf = !!userId && userId === target.authorId;

  useEffect(() => {
    if (!target.authorId) return;
    Promise.all([
      supabaseCount("follows", session?.access_token, `select=follower_id&following_id=eq.${target.authorId}`),
      supabaseCount("follows", session?.access_token, `select=following_id&follower_id=eq.${target.authorId}`),
    ])
      .then(([followers, followingCount]) => setCounts({ followers, following: followingCount }))
      .catch(() => {});
    supabaseSelect("profiles", session?.access_token, `select=is_private&id=eq.${target.authorId}`)
      .then((rows) => setTargetIsPrivate(!!rows[0]?.is_private))
      .catch(() => {});
    if (userId && !isSelf) {
      supabaseSelect("follows", session?.access_token, `select=follower_id&follower_id=eq.${userId}&following_id=eq.${target.authorId}`)
        .then((rows) => {
          if (rows.length > 0) {
            setFollowState("following");
            return;
          }
          return supabaseSelect(
            "follow_requests",
            session?.access_token,
            `select=id&requester_id=eq.${userId}&target_id=eq.${target.authorId}&pet_id=is.null&status=eq.pending`
          ).then((reqRows) => setFollowState(reqRows.length > 0 ? "pending" : "none"));
        })
        .catch(() => {});
    }
  }, [target.authorId, userId]);

  const toggleFollow = async () => {
    if (isGuest) return onRequireAuth();
    if (isSelf) return;
    // Gizlilik bilgisi henuz yuklenmediyse (veya sorgu hata verdiyse)
    // dogrudan takip/istek karari verilemez - islem yapma.
    if (targetIsPrivate === null) return;

    if (followState === "following") {
      setFollowState("none");
      try {
        await supabaseDelete("follows", session.access_token, `follower_id=eq.${userId}&following_id=eq.${target.authorId}`);
      } catch (e) {
        setFollowState("following");
      }
      return;
    }

    if (followState === "pending") {
      setFollowState("none");
      try {
        await supabaseDelete(
          "follow_requests",
          session.access_token,
          `requester_id=eq.${userId}&target_id=eq.${target.authorId}&pet_id=is.null&status=eq.pending`
        );
      } catch (e) {
        setFollowState("pending");
      }
      return;
    }

    if (targetIsPrivate) {
      setFollowState("pending");
      try {
        await supabaseInsert("follow_requests", session.access_token, { requester_id: userId, target_id: target.authorId });
      } catch (e) {
        setFollowState("none");
      }
    } else {
      setFollowState("following");
      try {
        await supabaseInsert("follows", session.access_token, { follower_id: userId, following_id: target.authorId });
      } catch (e) {
        setFollowState("none");
      }
    }
  };

  const followLabel = followState === "following" ? "Takip ediliyor" : followState === "pending" ? "İstek gönderildi" : "Takip Et";

  return (
    <div>
      <TopBar title={target.human} onBack={onBack} />
      <div style={{ padding: "20px 18px 40px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <BlobAvatar emoji={target.petEmoji} size={64} color={C.mustard} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.ink }}>{target.human}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft }}>{target.handle || ""}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          {!isSelf && (
            <button
              onClick={toggleFollow}
              disabled={targetIsPrivate === null}
              style={{
                flex: 1,
                background: followState === "none" ? C.pine : C.cream,
                color: followState === "none" ? C.cream : C.pine,
                border: `1.5px solid ${C.pine}`,
                borderRadius: 10,
                padding: "9px 14px",
                fontFamily: FONT_DISPLAY,
                fontSize: 12.5,
                cursor: targetIsPrivate === null ? "default" : "pointer",
                opacity: targetIsPrivate === null ? 0.6 : 1,
              }}
            >
              {followLabel}
            </button>
          )}
          <button
            onClick={() =>
              isGuest
                ? onRequireAuth()
                : onOpenChat({
                    targetId: target.authorId,
                    handle: target.handle,
                    human: target.human,
                    petEmoji: target.petEmoji,
                    color: C.mustard,
                  })
            }
            style={{ display: "flex", alignItems: "center", gap: 6, background: C.cream, color: C.ink, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "9px 14px", fontFamily: FONT_DISPLAY, fontSize: 12.5, cursor: "pointer" }}
          >
            <Mail size={14} /> Mesaj
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
          <div onClick={() => setListOpen("followers")} style={{ flex: 1, textAlign: "center", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 0", cursor: "pointer" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>{counts.followers}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>Takipçi</div>
          </div>
          <div onClick={() => setListOpen("following")} style={{ flex: 1, textAlign: "center", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 0", cursor: "pointer" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>{counts.following}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>Takip</div>
          </div>
          <div style={{ flex: 1, textAlign: "center", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 0" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>1</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>Dost</div>
          </div>
        </div>

        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink, marginBottom: 10 }}>Dostu</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 14px" }}>
          <span style={{ fontSize: 22 }}>{target.petEmoji}</span>
          <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5 }}>{target.pet}</span>
        </div>
      </div>

      {listOpen && (
        <FollowListModal
          title={listOpen === "followers" ? "Takipçiler" : "Takip Edilenler"}
          list={MOCK_FOLLOWERS}
          onClose={() => setListOpen(null)}
          onOpenProfile={(u) => {
            setListOpen(null);
            onOpenProfile(u);
          }}
        />
      )}
    </div>
  );
}
