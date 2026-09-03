import { useEffect, useRef, useState } from "react";
import { Lock, Globe, Plus, Camera, LogOut, X, Heart, MessageCircle, Ban, ChevronRight, User as UserIcon } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../../theme";
import { TopBar, BlobAvatar, EmptyState, ErrorBanner, TextField } from "../../components/ui";
import { FollowListModal } from "../../components/modals";
import { supabaseUpdate, supabaseCount, supabaseSelect, supabaseUploadImage, supabaseRpc, supabaseInsert, supabaseDelete } from "../../lib/supabase/client";
import { fetchFollowList } from "./followList";

const PET_TYPES = [
  { key: "cat", label: "Kedi", emoji: "🐱" },
  { key: "dog", label: "Köpek", emoji: "🐶" },
  { key: "other", label: "Diğer", emoji: "🐾" },
];

export function ProfileScreen({ session, userId, user, myPets, isPrivate, setIsPrivate, onOpenProfile, onLogout, onAddPet, onUpdateUserName }) {
  const [listOpen, setListOpen] = useState(null);
  const [dmPolicy, setDmPolicy] = useState("everyone");
  const [counts, setCounts] = useState({ followers: 0, following: 0, posts: 0 });
  const [myPosts, setMyPosts] = useState([]);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editHandle, setEditHandle] = useState("");
  const [editBio, setEditBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [editProfileError, setEditProfileError] = useState("");
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestError, setRequestError] = useState("");
  const [addingPetOpen, setAddingPetOpen] = useState(false);
  const [newPetName, setNewPetName] = useState("");
  const [newPetType, setNewPetType] = useState("cat");
  const [savingPet, setSavingPet] = useState(false);
  const [addPetError, setAddPetError] = useState("");
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedError, setBlockedError] = useState("");
  const [confirmUnblockId, setConfirmUnblockId] = useState(null);
  const [unblockingId, setUnblockingId] = useState(null);
  const [blockedPanelOpen, setBlockedPanelOpen] = useState(false);
  const [followListData, setFollowListData] = useState([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followListError, setFollowListError] = useState("");
  const [postMenuOpenId, setPostMenuOpenId] = useState(null);
  const [confirmDeletePostId, setConfirmDeletePostId] = useState(null);
  const [deletingPostId, setDeletingPostId] = useState(null);
  const [postDeleteError, setPostDeleteError] = useState("");
  const [expandedPostIds, setExpandedPostIds] = useState(() => new Set());
  const avatarInputRef = useRef(null);

  // Gonderilerim karti icin gereken tum veriyi (pet baglantisi, begeni/
  // yorum sayisi) tek seferde hazirlar - Feed.jsx'teki post_pets/pets
  // FK hint'leri ve tekillestirme deseniyle ayni (posts_pet_id_fkey/
  // post_pets_pet_id_fkey, migration dosyasindan dogrulandi).
  const loadMyPosts = async () => {
    const rows = await supabaseSelect(
      "posts",
      session?.access_token,
      `select=id,image_url,caption,created_at,pets!posts_pet_id_fkey(id,name,emoji),post_pets(pets!post_pets_pet_id_fkey(id,name,emoji))&author_id=eq.${userId}&order=created_at.desc`
    );
    const postIds = rows.map((r) => r.id);
    let likeRows = [];
    let commentRows = [];
    if (postIds.length > 0) {
      const idList = postIds.join(",");
      [likeRows, commentRows] = await Promise.all([
        supabaseSelect("likes", session?.access_token, `select=post_id&post_id=in.(${idList})`),
        supabaseSelect("comments", session?.access_token, `select=post_id&post_id=in.(${idList})`),
      ]);
    }
    return rows.map((r) => {
      const linkedPets = (r.post_pets || []).map((pp) => pp.pets).filter(Boolean);
      const petMap = new Map();
      [r.pets, ...linkedPets].forEach((p) => {
        if (p && p.id) petMap.set(p.id, p);
      });
      const pets = Array.from(petMap.values());
      return {
        id: r.id,
        imageUrl: r.image_url,
        caption: r.caption,
        createdAt: r.created_at,
        petsLabel: pets.length > 0 ? pets.map((p) => `${p.emoji || "🐾"} ${p.name}`).join(" & ") : null,
        likeCount: likeRows.filter((l) => l.post_id === r.id).length,
        commentCount: commentRows.filter((c) => c.post_id === r.id).length,
      };
    });
  };

  const deletePost = async (postId) => {
    setConfirmDeletePostId(null);
    setPostDeleteError("");
    setDeletingPostId(postId);
    try {
      // posts_delete RLS'i "author_id = auth.uid()" - bu ekrandaki tum
      // gonderiler zaten benim (select sorgusu author_id=eq.${userId}
      // ile sinirli), baska bir yetki gevsetmesi gerekmiyor. Ilgili
      // post_pets/likes/comments/contest_votes satirlari FK ON DELETE
      // CASCADE ile otomatik temizleniyor.
      await supabaseDelete("posts", session.access_token, `id=eq.${postId}`);
      setMyPosts((cur) => cur.filter((p) => p.id !== postId));
      setCounts((c) => ({ ...c, posts: Math.max(0, c.posts - 1) }));
    } catch (e) {
      setPostDeleteError(e.message);
    } finally {
      setDeletingPostId(null);
    }
  };

  const openFollowList = (kind) => {
    setListOpen(kind);
    setFollowListError("");
    setFollowListLoading(true);
    fetchFollowList(session, userId, kind)
      .then(setFollowListData)
      .catch((e) => setFollowListError(e.message))
      .finally(() => setFollowListLoading(false));
  };

  const refreshBlockedUsers = () => {
    // RLS ("Kullanıcı kendi engel listesini görür") zaten sadece
    // blocker_id=auth.uid() olan satirlari gosteriyor - karsi tarafin
    // beni engelledigi durumlar burada hic gorunmez, ekstra filtre
    // gerekmiyor.
    supabaseSelect(
      "blocks",
      session?.access_token,
      `select=blocked_id,profiles!blocks_blocked_id_fkey(display_name,handle,avatar_url)&blocker_id=eq.${userId}&order=created_at.desc`
    )
      .then(setBlockedUsers)
      .catch(() => {});
  };

  const unblockUser = async (blockedId) => {
    setConfirmUnblockId(null);
    setBlockedError("");
    setUnblockingId(blockedId);
    try {
      await supabaseDelete("blocks", session.access_token, `blocker_id=eq.${userId}&blocked_id=eq.${blockedId}`);
      setBlockedUsers((cur) => cur.filter((b) => b.blocked_id !== blockedId));
    } catch (e) {
      setBlockedError(e.message);
    } finally {
      setUnblockingId(null);
    }
  };

  const savePet = async () => {
    if (!newPetName.trim()) return;
    setAddPetError("");
    setSavingPet(true);
    try {
      const emoji = PET_TYPES.find((t) => t.key === newPetType)?.emoji || "🐾";
      const inserted = await supabaseInsert("pets", session.access_token, {
        owner_id: userId,
        name: newPetName.trim(),
        species: newPetType,
        emoji,
      });
      onAddPet && onAddPet(inserted[0]);
      setNewPetName("");
      setNewPetType("cat");
      setAddingPetOpen(false);
    } catch (e) {
      setAddPetError(e.message);
    } finally {
      setSavingPet(false);
    }
  };

  const refreshFollowerCount = () => {
    supabaseCount("follows", session?.access_token, `select=follower_id&following_id=eq.${userId}`)
      .then((followers) => setCounts((c) => ({ ...c, followers })))
      .catch(() => {});
  };

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      supabaseCount("follows", session?.access_token, `select=follower_id&following_id=eq.${userId}`),
      supabaseCount("follows", session?.access_token, `select=following_id&follower_id=eq.${userId}`),
      supabaseCount("posts", session?.access_token, `select=id&author_id=eq.${userId}`),
    ])
      .then(([followers, following, posts]) => setCounts({ followers, following, posts }))
      .catch(() => {});
    loadMyPosts()
      .then(setMyPosts)
      .catch(() => {});
    supabaseSelect("profiles", session?.access_token, `select=avatar_url,dm_policy,handle,bio&id=eq.${userId}`)
      .then((rows) => {
        setAvatarUrl(rows[0]?.avatar_url || null);
        if (rows[0]?.dm_policy) setDmPolicy(rows[0].dm_policy);
        setHandle(rows[0]?.handle || "");
        setBio(rows[0]?.bio || "");
      })
      .catch(() => {});
    // Hem insan (pet_id=null) hem pet takip istekleri - ayni RPC ile
    // yonetiliyor, pet_id'ye gore farkli metinle gosteriliyor.
    supabaseSelect(
      "follow_requests",
      session?.access_token,
      `select=id,pet_id,profiles!follow_requests_requester_id_fkey(display_name,handle,avatar_url),pets(name,emoji)&target_id=eq.${userId}&status=eq.pending&order=created_at.desc`
    )
      .then(setPendingRequests)
      .catch(() => {});
    refreshBlockedUsers();
  }, [userId]);

  const respondToRequest = async (requestId, newStatus, isPetRequest) => {
    setRequestError("");
    try {
      await supabaseRpc("respond_to_follow_request", session.access_token, { request_id: requestId, new_status: newStatus });
      setPendingRequests((cur) => cur.filter((r) => r.id !== requestId));
      // Insan istegi kabul edilince kendi takipci sayacimiz artiyor.
      // Pet istegi kabul edilince ilgili pet_follows kaydi olusuyor
      // (RPC tarafinda) - bu ekranda pet basina takipci sayaci
      // gosterilmedigi icin ayrica yenilenecek bir sayac yok.
      if (newStatus === "accepted" && !isPetRequest) refreshFollowerCount();
    } catch (e) {
      setRequestError(e.message);
    }
  };

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

  const openEditProfile = () => {
    setEditName(user.name || "");
    setEditHandle(handle || "");
    setEditBio(bio || "");
    setEditProfileError("");
    setEditProfileOpen(true);
  };

  const saveProfile = async () => {
    setEditProfileError("");
    if (!editName.trim()) {
      setEditProfileError("Ad boş olamaz.");
      return;
    }
    if (editBio.length > 160) {
      setEditProfileError("Biyografi en fazla 160 karakter olabilir.");
      return;
    }
    setSavingProfile(true);
    try {
      // profiles_update RLS'i (auth.uid()=id) zaten sadece kendi
      // profilimi guncellememe izin veriyor. handle icin tek kural
      // veritabanindaki UNIQUE kisiti (profiles_handle_key) - format/
      // rezerve kelime kontrolu roadmap'te henuz yok, o yuzden burada
      // da eklenmedi; catch, cakisma hatasini oldugu gibi gosteriyor.
      await supabaseUpdate("profiles", session.access_token, `id=eq.${userId}`, {
        display_name: editName.trim(),
        handle: editHandle.trim(),
        bio: editBio.trim() || null,
      });
      onUpdateUserName && onUpdateUserName(editName.trim());
      setHandle(editHandle.trim());
      setBio(editBio.trim());
      setEditProfileOpen(false);
    } catch (e) {
      setEditProfileError(e.message);
    } finally {
      setSavingProfile(false);
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
      <TopBar
        title="Profilim"
        right={
          <button onClick={() => setSettingsOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, fontSize: 18, padding: "0 4px" }}>
            ⋯
          </button>
        }
      />
      <div style={{ padding: "20px 18px 90px", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
          <div onClick={() => avatarInputRef.current?.click()} style={{ position: "relative", cursor: "pointer", flexShrink: 0 }}>
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: C.ink }}>{user.name || "Sen"}</div>
            {handle && <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft }}>{handle}</div>}
            {bio ? (
              <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.ink, lineHeight: 1.45, marginTop: 4, wordBreak: "break-word" }}>{bio}</div>
            ) : (
              <div onClick={openEditProfile} style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft, opacity: 0.65, marginTop: 4, cursor: "pointer" }}>
                Biyografi ekle
              </div>
            )}
            <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft, marginTop: 4 }}>
              {uploadingAvatar ? "Fotoğraf yükleniyor..." : `${myPets.length} dost`}
            </div>
          </div>
        </div>

        {pendingRequests.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink, marginBottom: 10 }}>Takip İstekleri</div>
            {requestError && <ErrorBanner style={{ marginBottom: 8 }}>{requestError}</ErrorBanner>}
            {pendingRequests.map((r) => (
              <div
                key={r.id}
                style={{ display: "flex", alignItems: "center", gap: 10, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 12px", marginBottom: 8 }}
              >
                {r.profiles?.avatar_url ? (
                  <img src={r.profiles.avatar_url} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <BlobAvatar emoji="🙂" size={40} color={C.pine} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {r.pet_id ? (
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>
                      {r.profiles?.display_name || "Kullanıcı"}, {r.pets?.emoji || "🐾"} {r.pets?.name || "dostu"} adlı dostunu takip etmek istiyor
                    </div>
                  ) : (
                    <>
                      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>{r.profiles?.display_name || "Kullanıcı"}</div>
                      {r.profiles?.handle && <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{r.profiles.handle}</div>}
                    </>
                  )}
                </div>
                <button
                  onClick={() => respondToRequest(r.id, "accepted", !!r.pet_id)}
                  style={{ background: C.pine, color: C.cream, border: "none", borderRadius: 10, padding: "7px 12px", fontFamily: FONT_DISPLAY, fontSize: 12, cursor: "pointer" }}
                >
                  Kabul et
                </button>
                <button
                  onClick={() => respondToRequest(r.id, "rejected", !!r.pet_id)}
                  style={{ background: "none", color: C.inkSoft, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "7px 12px", fontFamily: FONT_DISPLAY, fontSize: 12, cursor: "pointer" }}
                >
                  Reddet
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink, marginBottom: 10 }}>Dostlarım</div>
        <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
          {myPets.map((p) => (
            <div key={p.id || p.name} style={{ display: "flex", alignItems: "center", gap: 8, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 12px" }}>
              <span style={{ fontSize: 18 }}>{p.emoji}</span>
              <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13 }}>{p.name}</span>
            </div>
          ))}
          <div
            onClick={() => setAddingPetOpen((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, border: `2px dashed ${C.line}`, borderRadius: 12, padding: "8px 12px", color: C.inkSoft, cursor: "pointer" }}
          >
            <Plus size={15} />
            <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13 }}>Ekle</span>
          </div>
        </div>

        {addingPetOpen && (
          <div style={{ background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, marginBottom: 22 }}>
            {addPetError && <ErrorBanner style={{ marginBottom: 8 }}>{addPetError}</ErrorBanner>}
            <input
              autoFocus
              value={newPetName}
              onChange={(e) => setNewPetName(e.target.value)}
              placeholder="Hayvanının adı"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: `2px solid ${C.line}`, fontFamily: FONT_BODY, fontSize: 13.5, color: C.ink, background: C.paper, outline: "none", marginBottom: 10 }}
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {PET_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setNewPetType(t.key)}
                  style={{
                    flex: 1,
                    padding: "8px 6px",
                    borderRadius: 10,
                    border: `2px solid ${newPetType === t.key ? C.mustard : C.line}`,
                    background: newPetType === t.key ? "#FDF1D8" : C.paper,
                    fontFamily: FONT_BODY,
                    fontWeight: 700,
                    fontSize: 12,
                    color: C.ink,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 16 }}>{t.emoji}</div>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={savePet}
                disabled={!newPetName.trim() || savingPet}
                style={{ flex: 1, background: C.pine, color: C.cream, border: "none", borderRadius: 10, padding: "10px 12px", fontFamily: FONT_DISPLAY, fontSize: 13, cursor: !newPetName.trim() || savingPet ? "default" : "pointer", opacity: !newPetName.trim() || savingPet ? 0.6 : 1 }}
              >
                {savingPet ? "Ekleniyor..." : "Kaydet"}
              </button>
              <button
                onClick={() => {
                  setAddingPetOpen(false);
                  setAddPetError("");
                }}
                style={{ background: "none", color: C.inkSoft, border: `1.5px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontFamily: FONT_DISPLAY, fontSize: 13, cursor: "pointer" }}
              >
                Vazgeç
              </button>
            </div>
          </div>
        )}

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
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink }}>{counts.posts}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft }}>Gönderi</div>
          </div>
        </div>

        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink, margin: "22px 0 10px" }}>Gönderilerim</div>
        {postDeleteError && <ErrorBanner style={{ marginBottom: 8 }}>{postDeleteError}</ErrorBanner>}
        {myPosts.length === 0 ? (
          <EmptyState padding="24px 0">Henüz gönderin yok — ilk flick'ini paylaş 🐾</EmptyState>
        ) : (
          <div>
            {myPosts.map((p) => {
              const isLong = (p.caption || "").length > 220;
              const expanded = expandedPostIds.has(p.id);
              const dateLabel = p.createdAt
                ? new Date(p.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
                : null;
              return (
                <div
                  key={p.id}
                  style={{
                    position: "relative",
                    background: "#fff",
                    border: `1px solid ${C.line}`,
                    borderRadius: 18,
                    padding: 14,
                    marginBottom: 12,
                    boxSizing: "border-box",
                    maxWidth: "100%",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: C.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.petsLabel || "🐾 Gönderi"}
                    </div>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <button
                        onClick={() => setPostMenuOpenId((cur) => (cur === p.id ? null : p.id))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, fontSize: 18, padding: "0 4px", lineHeight: 1 }}
                      >
                        ⋯
                      </button>
                      {postMenuOpenId === p.id && (
                        <div
                          style={{ position: "absolute", right: 0, top: 24, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 6px 18px rgba(0,0,0,0.08)", zIndex: 10, minWidth: 140 }}
                        >
                          <button
                            onClick={() => {
                              setPostMenuOpenId(null);
                              setConfirmDeletePostId(p.id);
                            }}
                            disabled={deletingPostId === p.id}
                            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 11px", background: "none", border: "none", cursor: deletingPostId === p.id ? "default" : "pointer", fontFamily: FONT_BODY, fontSize: 12.5, color: C.coral, textAlign: "left", opacity: deletingPostId === p.id ? 0.6 : 1, whiteSpace: "nowrap" }}
                          >
                            <X size={13} /> {deletingPostId === p.id ? "Siliniyor..." : "Gönderiyi sil"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {p.imageUrl && (
                    // Ana akistaki (Feed.jsx PostCard) ile AYNI gosterim yontemi:
                    // objectFit "contain" - goruntu kirpilmiyor, gerekirse
                    // C.paper zeminle bosluklu gosteriliyor. Sadece kompakt
                    // kart baglaminda maxHeight dusuruldu, mantik ayni.
                    <img
                      src={p.imageUrl}
                      alt={p.caption}
                      style={{ width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 12, display: "block", marginBottom: 10, background: C.paper }}
                    />
                  )}

                  {p.caption && (
                    <div
                      style={{
                        fontFamily: FONT_BODY,
                        fontSize: 13.5,
                        color: C.ink,
                        lineHeight: 1.5,
                        marginBottom: 4,
                        wordBreak: "break-word",
                        ...(!expanded && isLong
                          ? { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }
                          : {}),
                      }}
                    >
                      {p.caption}
                    </div>
                  )}
                  {isLong && (
                    <div
                      onClick={() =>
                        setExpandedPostIds((cur) => {
                          const next = new Set(cur);
                          if (next.has(p.id)) next.delete(p.id);
                          else next.add(p.id);
                          return next;
                        })
                      }
                      style={{ fontFamily: FONT_BODY, fontSize: 12, fontWeight: 700, color: C.mustard, cursor: "pointer", marginBottom: 8 }}
                    >
                      {expanded ? "Daha az göster" : "Devamını gör"}
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: C.inkSoft }}>
                      <Heart size={14} />
                      <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>{p.likeCount}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: C.inkSoft }}>
                      <MessageCircle size={14} />
                      <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>{p.commentCount}</span>
                    </div>
                    {dateLabel && (
                      <span style={{ marginLeft: "auto", fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, opacity: 0.7 }}>{dateLabel}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
            onOpenProfile && onOpenProfile(u);
          }}
        />
      )}

      {settingsOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(36,33,29,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
          onClick={() => setSettingsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.paper, borderRadius: "22px 22px 0 0", padding: "18px 18px 24px", width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", boxSizing: "border-box" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.ink }}>Ayarlar</div>
              <button onClick={() => setSettingsOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
                <X size={20} />
              </button>
            </div>

            <div
              onClick={() => {
                setSettingsOpen(false);
                openEditProfile();
              }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 16px", marginBottom: 14, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <UserIcon size={18} color={C.inkSoft} />
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>Profili düzenle</div>
              </div>
              <ChevronRight size={18} color={C.inkSoft} />
            </div>

            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: C.inkSoft, marginBottom: 8 }}>Profil Gizliliği</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 16px", marginBottom: 6 }}>
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
            <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, marginBottom: 18, lineHeight: 1.5 }}>
              Not: Yarışmaya girdiğin gönderiler, profil ayarından bağımsız olarak oy verilebilmesi için her zaman herkese açık olur.
            </div>

            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, color: C.inkSoft, marginBottom: 8 }}>Mesaj İzinleri</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
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

            <div
              onClick={() => setBlockedPanelOpen(true)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 16px", marginBottom: 18, cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Ban size={18} color={C.inkSoft} />
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>Engellenen Hesaplar</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {blockedUsers.length > 0 && (
                  <span style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>{blockedUsers.length}</span>
                )}
                <ChevronRight size={18} color={C.inkSoft} />
              </div>
            </div>

            <button
              onClick={onLogout}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
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
        </div>
      )}

      {editProfileOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(36,33,29,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 55 }}
          onClick={() => setEditProfileOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.paper, borderRadius: "22px 22px 0 0", padding: "18px 18px 24px", width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", boxSizing: "border-box" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.ink }}>Profili düzenle</div>
              <button onClick={() => setEditProfileOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
                <X size={20} />
              </button>
            </div>
            {editProfileError && <ErrorBanner style={{ marginBottom: 12 }}>{editProfileError}</ErrorBanner>}
            <TextField label="Görünen ad" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Adın Soyadın" />
            <TextField label="Kullanıcı adı" value={editHandle} onChange={(e) => setEditHandle(e.target.value)} placeholder="@kullaniciadi" />
            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft }}>Biyografi</span>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value.slice(0, 160))}
                placeholder="Kendinden ve dostlarından kısaca bahset..."
                rows={3}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  marginTop: 6,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `2px solid ${C.line}`,
                  fontFamily: FONT_BODY,
                  fontSize: 14,
                  color: C.ink,
                  background: C.cream,
                  outline: "none",
                  resize: "none",
                }}
              />
              <div style={{ textAlign: "right", fontFamily: FONT_BODY, fontSize: 11, color: C.inkSoft, marginTop: 4 }}>{editBio.length}/160</div>
            </label>
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              style={{ width: "100%", background: C.pine, color: C.cream, border: "none", borderRadius: 12, padding: "12px 14px", fontFamily: FONT_DISPLAY, fontSize: 13.5, cursor: savingProfile ? "default" : "pointer", opacity: savingProfile ? 0.6 : 1 }}
            >
              {savingProfile ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      )}

      {blockedPanelOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(36,33,29,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
          onClick={() => setBlockedPanelOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.paper, borderRadius: "22px 22px 0 0", padding: "18px 18px 24px", width: "100%", maxWidth: 480, maxHeight: "65vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontSize: 16, color: C.ink }}>Engellenen Hesaplar</div>
              <button onClick={() => setBlockedPanelOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
                <X size={20} />
              </button>
            </div>
            {blockedError && <ErrorBanner style={{ marginBottom: 8 }}>{blockedError}</ErrorBanner>}
            {blockedUsers.length === 0 ? (
              <EmptyState padding="20px 0">Şu an kimseyi engellemiş değilsin.</EmptyState>
            ) : (
              blockedUsers.map((b) => (
                <div
                  key={b.blocked_id}
                  style={{ display: "flex", alignItems: "center", gap: 10, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 12px", marginBottom: 8 }}
                >
                  {b.profiles?.avatar_url ? (
                    <img src={b.profiles.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <BlobAvatar emoji="🙂" size={36} color={C.inkSoft} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>{b.profiles?.display_name || "Kullanıcı"}</div>
                    {b.profiles?.handle && <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft }}>{b.profiles.handle}</div>}
                  </div>
                  <button
                    onClick={() => setConfirmUnblockId(b.blocked_id)}
                    disabled={unblockingId === b.blocked_id}
                    style={{
                      background: "none",
                      color: C.coral,
                      border: `1.5px solid ${C.coral}`,
                      borderRadius: 10,
                      padding: "7px 12px",
                      fontFamily: FONT_DISPLAY,
                      fontSize: 12,
                      cursor: unblockingId === b.blocked_id ? "default" : "pointer",
                      opacity: unblockingId === b.blocked_id ? 0.6 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {unblockingId === b.blocked_id ? "..." : "Engeli kaldır"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {confirmUnblockId && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(36,33,29,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
          onClick={() => setConfirmUnblockId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.paper, borderRadius: "22px 22px 0 0", padding: "20px 20px 28px", width: "100%", maxWidth: 480 }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink, marginBottom: 8 }}>
              {blockedUsers.find((b) => b.blocked_id === confirmUnblockId)?.profiles?.display_name || "Bu kullanıcının"} engeli kaldırılsın mı?
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, marginBottom: 20, lineHeight: 1.5 }}>
              Birbirinizi tekrar takip edebilir, takip isteği gönderebilirsiniz.
            </div>
            <button
              onClick={() => unblockUser(confirmUnblockId)}
              style={{ width: "100%", marginBottom: 8, background: C.pine, color: C.cream, border: "none", borderRadius: 12, padding: "12px 14px", fontFamily: FONT_DISPLAY, fontSize: 13.5, cursor: "pointer" }}
            >
              Engeli kaldır
            </button>
            <button
              onClick={() => setConfirmUnblockId(null)}
              style={{ width: "100%", background: "none", color: C.inkSoft, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", fontFamily: FONT_DISPLAY, fontSize: 13.5, cursor: "pointer" }}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {confirmDeletePostId && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(36,33,29,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}
          onClick={() => setConfirmDeletePostId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.paper, borderRadius: "22px 22px 0 0", padding: "20px 20px 28px", width: "100%", maxWidth: 480 }}
          >
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 17, color: C.ink, marginBottom: 8 }}>Gönderi silinsin mi?</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, marginBottom: 20, lineHeight: 1.5 }}>
              Bu işlem geri alınamaz.
            </div>
            <button
              onClick={() => deletePost(confirmDeletePostId)}
              style={{ width: "100%", marginBottom: 8, background: C.coral, color: C.cream, border: "none", borderRadius: 12, padding: "12px 14px", fontFamily: FONT_DISPLAY, fontSize: 13.5, cursor: "pointer" }}
            >
              Gönderiyi sil
            </button>
            <button
              onClick={() => setConfirmDeletePostId(null)}
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
