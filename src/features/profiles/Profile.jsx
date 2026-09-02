import { useEffect, useRef, useState } from "react";
import { Lock, Globe, Plus, Camera, LogOut } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../../theme";
import { TopBar, BlobAvatar, EmptyState } from "../../components/ui";
import { FollowListModal } from "../../components/modals";
import { MOCK_FOLLOWERS } from "../../mockData";
import { supabaseUpdate, supabaseCount, supabaseSelect, supabaseUploadImage } from "../../lib/supabase/client";

export function ProfileScreen({ session, userId, user, myPets, isPrivate, setIsPrivate, onOpenProfile, onLogout }) {
  const [listOpen, setListOpen] = useState(null);
  const [dmPolicy, setDmPolicy] = useState("everyone");
  const [counts, setCounts] = useState({ followers: 0, following: 0, posts: 0 });
  const [myPosts, setMyPosts] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      supabaseCount("follows", session?.access_token, `select=follower_id&following_id=eq.${userId}`),
      supabaseCount("follows", session?.access_token, `select=following_id&follower_id=eq.${userId}`),
      supabaseCount("posts", session?.access_token, `select=id&author_id=eq.${userId}`),
    ])
      .then(([followers, following, posts]) => setCounts({ followers, following, posts }))
      .catch(() => {});
    supabaseSelect("posts", session?.access_token, `select=id,image_url,caption&author_id=eq.${userId}&order=created_at.desc`)
      .then(setMyPosts)
      .catch(() => {});
    supabaseSelect("profiles", session?.access_token, `select=avatar_url,dm_policy&id=eq.${userId}`)
      .then((rows) => {
        setAvatarUrl(rows[0]?.avatar_url || null);
        if (rows[0]?.dm_policy) setDmPolicy(rows[0].dm_policy);
      })
      .catch(() => {});
  }, [userId]);

  const changeDmPolicy = async (policy) => {
    setDmPolicy(policy);
    try {
      await supabaseUpdate("profiles", session.access_token, `id=eq.${userId}`, { dm_policy: policy });
    } catch (e) {}
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploadingAvatar(true);
    try {
      const path = `avatars/${userId}/${Date.now()}-${file.name}`;
      const url = await supabaseUploadImage(path, file, session.access_token);
      await supabaseUpdate("profiles", session.access_token, `id=eq.${userId}`, { avatar_url: url });
      setAvatarUrl(url);
    } catch (e) {
      // sessiz geç
    } finally {
      setUploadingAvatar(false);
    }
  };

  const togglePrivate = async () => {
    const next = !isPrivate;
    setIsPrivate(next);
    try {
      await supabaseUpdate("profiles", session.access_token, `id=eq.${userId}`, { is_private: next });
    } catch (e) {
      setIsPrivate(!next);
    }
  };

  return (
    <div>
      <TopBar title="Profilim" />
      <div style={{ padding: "20px 18px 90px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
          <div onClick={() => avatarInputRef.current?.click()} style={{ position: "relative", cursor: "pointer" }}>
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profil fotoğrafı"
                style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.pine}`, display: "block" }}
              />
            ) : (
              <BlobAvatar emoji="🙂" size={64} color={C.pine} />
            )}
            <div
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: C.mustard,
                border: `2px solid ${C.paper}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={11} color={C.cream} />
            </div>
          </div>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.ink }}>{user.name || "Sen"}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft }}>
              {uploadingAvatar ? "Fotoğraf yükleniyor..." : `${myPets.length} dost`}
            </div>
          </div>
        </div>

        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink, marginBottom: 10 }}>Dostlarım</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
          {myPets.map((p) => (
            <div key={p.id || p.name} style={{ display: "flex", alignItems: "center", gap: 8, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 12px" }}>
              <span style={{ fontSize: 18 }}>{p.emoji}</span>
              <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13 }}>{p.name}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 6, border: `2px dashed ${C.line}`, borderRadius: 12, padding: "8px 12px", color: C.inkSoft, cursor: "pointer" }}>
            <Plus size={15} />
            <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13 }}>Ekle</span>
          </div>
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
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>{counts.posts}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>Gönderi</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isPrivate ? <Lock size={18} color={C.pine} /> : <Globe size={18} color={C.mustard} />}
            <div>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>{isPrivate ? "Kapalı Profil" : "Açık Profil"}</div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{isPrivate ? "Sadece takipçilerin görebilir" : "Herkes görebilir"}</div>
            </div>
          </div>
          <button
            onClick={togglePrivate}
            style={{ width: 44, height: 26, borderRadius: 13, border: "none", background: isPrivate ? C.pine : C.line, position: "relative", cursor: "pointer" }}
          >
            <div style={{ width: 20, height: 20, borderRadius: "50%", background: C.cream, position: "absolute", top: 3, left: isPrivate ? 21 : 3, transition: "left 0.15s ease" }} />
          </button>
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, marginTop: 8, lineHeight: 1.5, marginBottom: 20 }}>
          Not: Yarışmaya girdiğin gönderiler, profil ayarından bağımsız olarak oy verilebilmesi için her zaman herkese açık olur.
        </div>

        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink, marginBottom: 10 }}>Kimler mesaj atabilir?</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { key: "everyone", label: "Herkes" },
            { key: "followers", label: "Sadece Takipçiler" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => changeDmPolicy(opt.key)}
              style={{
                flex: 1,
                padding: "11px 8px",
                borderRadius: 12,
                border: `2px solid ${dmPolicy === opt.key ? C.mustard : C.line}`,
                background: dmPolicy === opt.key ? "#FDF1D8" : C.cream,
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 12.5,
                color: C.ink,
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink, margin: "22px 0 10px" }}>Gönderilerim</div>
        {myPosts.length === 0 ? (
          <EmptyState padding="20px 0">Henüz gönderin yok.</EmptyState>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {myPosts.map((p) =>
              p.image_url ? (
                <div key={p.id} style={{ aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden" }}>
                  <img src={p.image_url} alt={p.caption} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ) : (
                <div
                  key={p.id}
                  style={{
                    aspectRatio: "1 / 1",
                    borderRadius: 12,
                    background: C.cream,
                    border: `1px solid ${C.line}`,
                    padding: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    fontFamily: FONT_BODY,
                    fontSize: 11,
                    color: C.inkSoft,
                    overflow: "hidden",
                  }}
                >
                  {p.caption}
                </div>
              )
            )}
          </div>
        )}

        <button
          onClick={onLogout}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            marginTop: 28,
            padding: "12px 8px",
            borderRadius: 12,
            border: `1.5px solid ${C.line}`,
            background: "none",
            fontFamily: FONT_BODY,
            fontWeight: 700,
            fontSize: 13,
            color: C.coral,
            cursor: "pointer",
          }}
        >
          <LogOut size={15} /> Çıkış yap
        </button>
      </div>
      {listOpen && (
        <FollowListModal
          title={listOpen === "followers" ? "Takipçiler" : "Takip Edilenler"}
          list={MOCK_FOLLOWERS}
          onClose={() => setListOpen(null)}
          onOpenProfile={(u) => {
            setListOpen(null);
            onOpenProfile && onOpenProfile(u);
          }}
        />
      )}
    </div>
  );
}
