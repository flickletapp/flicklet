import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../../theme";
import { TopBar, BlobAvatar } from "../../components/ui";
import { FollowListModal } from "../../components/modals";
import { MOCK_FOLLOWERS } from "../../mockData";
import { supabaseCount, supabaseSelect } from "../../lib/supabase/client";
import { useHumanFollow } from "./useHumanFollow";
import { usePetFollow } from "./usePetFollow";

function PetFollowRow({ pet, session, userId, ownerId, isGuest, onRequireAuth }) {
  const { followState, followLabel, isOwn, disabled, toggleFollow } = usePetFollow({
    session,
    userId,
    petId: pet.id,
    ownerId,
    isGuest,
    onRequireAuth,
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 14px", marginBottom: 8 }}>
      <span style={{ fontSize: 22 }}>{pet.emoji || "🐾"}</span>
      <span style={{ flex: 1, fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13.5 }}>{pet.name}</span>
      {!isOwn && (
        <button
          onClick={toggleFollow}
          disabled={disabled}
          style={{
            background: followState === "none" ? C.pine : C.cream,
            color: followState === "none" ? C.cream : C.pine,
            border: `1.5px solid ${C.pine}`,
            borderRadius: 10,
            padding: "6px 11px",
            fontFamily: FONT_DISPLAY,
            fontSize: 11.5,
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {followLabel}
        </button>
      )}
    </div>
  );
}

export function UserProfileView({ target, session, userId, onBack, onOpenProfile, onOpenChat, isGuest, onRequireAuth }) {
  const [listOpen, setListOpen] = useState(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [pets, setPets] = useState([]);
  const { followState, followLabel, isSelf, disabled, toggleFollow } = useHumanFollow({
    session,
    userId,
    targetId: target.authorId,
    isGuest,
    onRequireAuth,
    // Sadece dogrudan follows insert/delete basarili oldugunda tetiklenir
    // (pending istek olusturma/iptalinde degil) - negatif sayi olusmasin
    // diye alt sinir 0.
    onFollowChange: (delta) => setCounts((c) => ({ ...c, followers: Math.max(0, c.followers + delta) })),
  });

  useEffect(() => {
    if (!target.authorId) return;
    Promise.all([
      supabaseCount("follows", session?.access_token, `select=follower_id&following_id=eq.${target.authorId}`),
      supabaseCount("follows", session?.access_token, `select=following_id&follower_id=eq.${target.authorId}`),
    ])
      .then(([followers, followingCount]) => setCounts({ followers, following: followingCount }))
      .catch(() => {});
    supabaseSelect("pets", session?.access_token, `select=id,name,emoji&owner_id=eq.${target.authorId}`)
      .then(setPets)
      .catch(() => {});
  }, [target.authorId]);

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
              disabled={disabled}
              style={{
                flex: 1,
                background: followState === "none" ? C.pine : C.cream,
                color: followState === "none" ? C.cream : C.pine,
                border: `1.5px solid ${C.pine}`,
                borderRadius: 10,
                padding: "9px 14px",
                fontFamily: FONT_DISPLAY,
                fontSize: 12.5,
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.6 : 1,
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
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>{pets.length}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>Dost</div>
          </div>
        </div>

        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink, marginBottom: 10 }}>Dostları</div>
        {pets.map((pet) => (
          <PetFollowRow key={pet.id} pet={pet} session={session} userId={userId} ownerId={target.authorId} isGuest={isGuest} onRequireAuth={onRequireAuth} />
        ))}
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
