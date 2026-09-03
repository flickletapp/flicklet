import { useEffect, useState } from "react";
import { Mail, X } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../../theme";
import { TopBar, BlobAvatar, ErrorBanner } from "../../components/ui";
import { FollowListModal } from "../../components/modals";
import { supabaseCount, supabaseSelect, supabaseDelete, supabaseRpc } from "../../lib/supabase/client";
import { useHumanFollow } from "./useHumanFollow";
import { usePetFollow } from "./usePetFollow";
import { fetchFollowList } from "./followList";

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
  // iBlockedThem: sadece BEN silebilecegim bir blocks satirim var mi
  // (RLS ile dogrudan gorebiliyorum). blockedEitherWay: iki yonlu
  // gercek engel durumu - `blocked_with` RPC'si RLS'in gosteremedigi
  // "onlar beni blockladi" yonunu de kapsar, hangi tarafin blockladigini
  // ifsa etmeden sadece true/false doner.
  const [iBlockedThem, setIBlockedThem] = useState(false);
  const [blockedEitherWay, setBlockedEitherWay] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  const [blockWorking, setBlockWorking] = useState(false);
  const [blockError, setBlockError] = useState("");
  const [followListData, setFollowListData] = useState([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followListError, setFollowListError] = useState("");
  // target prop'u (post/arama sonucundan gelen) eski/eksik olabilir -
  // ad/kullanici adi/biyografi icin profiles'tan taze veri cekiliyor.
  const [profile, setProfile] = useState(null);
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

  const refreshCounts = () => {
    if (!target.authorId) return;
    Promise.all([
      supabaseCount("follows", session?.access_token, `select=follower_id&following_id=eq.${target.authorId}`),
      supabaseCount("follows", session?.access_token, `select=following_id&follower_id=eq.${target.authorId}`),
    ])
      .then(([followers, followingCount]) => setCounts({ followers, following: followingCount }))
      .catch(() => {});
  };

  const refreshBlockState = () => {
    if (!userId || userId === target.authorId) return;
    // Kendi olusturdugum blok satirini dogrudan gorebiliyorum (RLS).
    supabaseSelect("blocks", session?.access_token, `select=blocked_id&blocker_id=eq.${userId}&blocked_id=eq.${target.authorId}`)
      .then((rows) => setIBlockedThem(rows.length > 0))
      .catch(() => {});
    // Iki yonlu gercek durumu (karsi taraf beni blockladiysa da dahil)
    // SADECE bu RPC ile ogrenebilirim - RLS kendi basina bunu gostermez.
    supabaseRpc("blocked_with", session?.access_token, { other_user_id: target.authorId })
      .then(setBlockedEitherWay)
      .catch(() => {});
  };

  useEffect(() => {
    if (!target.authorId) return;
    refreshCounts();
    supabaseSelect("pets", session?.access_token, `select=id,name,emoji&owner_id=eq.${target.authorId}`)
      .then(setPets)
      .catch(() => {});
    supabaseSelect("profiles", session?.access_token, `select=display_name,handle,bio,avatar_url&id=eq.${target.authorId}`)
      .then((rows) => setProfile(rows[0] || null))
      .catch(() => {});
    refreshBlockState();
  }, [target.authorId, userId]);

  const displayName = profile?.display_name || target.human;
  const displayHandle = profile?.handle || target.handle || "";

  const openFollowList = (kind) => {
    setListOpen(kind);
    setFollowListError("");
    setFollowListLoading(true);
    fetchFollowList(session, target.authorId, kind)
      .then(setFollowListData)
      .catch((e) => setFollowListError(e.message))
      .finally(() => setFollowListLoading(false));
  };

  const confirmBlock = async () => {
    setConfirmBlockOpen(false);
    setBlockError("");
    setBlockWorking(true);
    try {
      // Atomik: blocks satirini ekler VE iki yonlu follows/pet_follows/
      // bekleyen follow_requests'i tek transaction'da temizler (bkz.
      // db/migrations/005_block_user_rpc.up.sql) - RLS'in tek basina
      // izin vermedigi "karsi tarafin bana ait satirlari" da kapsar.
      await supabaseRpc("block_user", session.access_token, { blocked_user_id: target.authorId });
      setIBlockedThem(true);
      setBlockedEitherWay(true);
      refreshCounts();
    } catch (e) {
      setBlockError(e.message);
    } finally {
      setBlockWorking(false);
    }
  };

  const unblock = async () => {
    setBlockError("");
    setBlockWorking(true);
    try {
      // "Kullanıcı engeli kaldırır" RLS'i (blocker_id = auth.uid())
      // zaten sadece kendi olusturdugum engeli kaldirmama izin veriyor -
      // ek bir yetki kontrolu gerekmiyor.
      await supabaseDelete("blocks", session.access_token, `blocker_id=eq.${userId}&blocked_id=eq.${target.authorId}`);
      setIBlockedThem(false);
      refreshBlockState();
      refreshCounts();
    } catch (e) {
      setBlockError(e.message);
    } finally {
      setBlockWorking(false);
    }
  };

  if (blockedEitherWay) {
    return (
      <div>
        <TopBar title={displayName} onBack={onBack} />
        <div className="fl-col" style={{ padding: "40px 24px", textAlign: "center" }}>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.inkSoft, marginBottom: 18, lineHeight: 1.5 }}>
            {iBlockedThem
              ? `${displayName} adlı kullanıcıyı engelledin. Birbirinizi takip edemez, istek gönderemezsiniz.`
              : "Bu profil şu anda görüntülenemiyor."}
          </div>
          {blockError && <ErrorBanner style={{ marginBottom: 12 }}>{blockError}</ErrorBanner>}
          {iBlockedThem && (
            <button
              onClick={unblock}
              disabled={blockWorking}
              style={{
                background: "none",
                color: C.coral,
                border: `1.5px solid ${C.coral}`,
                borderRadius: 10,
                padding: "10px 18px",
                fontFamily: FONT_DISPLAY,
                fontSize: 13,
                cursor: blockWorking ? "default" : "pointer",
                opacity: blockWorking ? 0.6 : 1,
              }}
            >
              {blockWorking ? "..." : "Engeli kaldır"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar
        title={displayName}
        onBack={onBack}
        right={
          !isSelf && (
            <div style={{ position: "relative" }}>
              <button onClick={() => setMenuOpen((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, fontSize: 18, padding: "0 4px" }}>
                ⋯
              </button>
              {menuOpen && (
                <div style={{ position: "absolute", right: 0, top: 26, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 6px 18px rgba(0,0,0,0.08)", zIndex: 10, minWidth: 150 }}>
                  <button
                    onClick={() => {
                      if (isGuest) return onRequireAuth();
                      setMenuOpen(false);
                      setConfirmBlockOpen(true);
                    }}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", background: "none", border: "none", cursor: "pointer", fontFamily: FONT_BODY, fontSize: 13, color: C.coral, textAlign: "left", whiteSpace: "nowrap" }}
                  >
                    <X size={14} /> Engelle
                  </button>
                </div>
              )}
            </div>
          )
        }
      />
      <div className="fl-col" style={{ padding: "20px 18px 40px" }}>
        {blockError && <ErrorBanner style={{ marginBottom: 14 }}>{blockError}</ErrorBanner>}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <BlobAvatar emoji={target.petEmoji} size={64} color={C.mustard} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.ink }}>{displayName}</div>
            {displayHandle && <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft }}>{displayHandle}</div>}
            {profile?.bio && (
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.ink, lineHeight: 1.45, marginTop: 4, wordBreak: "break-word" }}>{profile.bio}</div>
            )}
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
                    handle: displayHandle,
                    human: displayName,
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
          <div onClick={() => openFollowList("followers")} style={{ flex: 1, textAlign: "center", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 0", cursor: "pointer" }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>{counts.followers}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>Takipçi</div>
          </div>
          <div onClick={() => openFollowList("following")} style={{ flex: 1, textAlign: "center", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 0", cursor: "pointer" }}>
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
          list={followListData}
          loading={followListLoading}
          error={followListError}
          onClose={() => setListOpen(null)}
          onOpenProfile={(u) => {
            setListOpen(null);
            onOpenProfile(u);
          }}
        />
      )}

      {confirmBlockOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(36,33,29,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
          onClick={(e) => {
            e.stopPropagation();
            setConfirmBlockOpen(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.paper, borderRadius: "22px 22px 0 0", padding: "20px 20px 28px", width: "100%", maxWidth: 480 }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink, marginBottom: 8 }}>{displayName} engellensin mi?</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, marginBottom: 20, lineHeight: 1.5 }}>
              Birbirinizi bir daha takip edemez, takip isteği gönderemezsiniz. Mevcut takip/istek bağlantılarınız (izin verdiğimiz ölçüde) temizlenir.
            </div>
            <button
              onClick={confirmBlock}
              style={{ width: "100%", marginBottom: 8, background: C.coral, color: C.cream, border: "none", borderRadius: 12, padding: "12px 14px", fontFamily: FONT_DISPLAY, fontSize: 13.5, cursor: "pointer" }}
            >
              Engelle
            </button>
            <button
              onClick={() => setConfirmBlockOpen(false)}
              style={{ width: "100%", background: "none", color: C.inkSoft, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", fontFamily: FONT_DISPLAY, fontSize: 13.5, cursor: "pointer" }}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
