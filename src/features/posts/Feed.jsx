import { useEffect, useState } from "react";
import { Heart, MessageCircle, Trophy, Flag, X, Search, Mail, Flame, Plus } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../../theme";
import { TopBar, BlobAvatar, PawBadge, LoadingState, EmptyState, ErrorBanner, TrendingSection, FlickletLogo, ResolvedImage } from "../../components/ui";
import { CommentsModal } from "../../components/modals";
import { supabaseSelect, supabaseInsert, supabaseUpsert, supabaseDelete, supabaseCount, supabaseRpc } from "../../lib/supabase/client";
import { useHumanFollow } from "../profiles/useHumanFollow";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function loadFeed(session, userId) {
  const rows = await supabaseSelect(
    "posts",
    session?.access_token,
    "select=id,author_id,pet_id,caption,image_url,contest_category,created_at,profiles!posts_author_id_fkey(display_name,is_private),pets!posts_pet_id_fkey(id,name,emoji),post_pets(pets!post_pets_pet_id_fkey(id,name,emoji))&order=created_at.desc"
  );
  const postIds = rows.map((r) => r.id);
  let likeRows = [];
  let commentRows = [];
  let followingIds = new Set();
  let blockedIds = new Set();
  let hasVotedToday = false;
  if (postIds.length > 0) {
    const idList = postIds.join(",");
    [likeRows, commentRows] = await Promise.all([
      supabaseSelect("likes", session?.access_token, `select=post_id,user_id&post_id=in.(${idList})`),
      supabaseSelect("comments", session?.access_token, `select=post_id&post_id=in.(${idList})`),
    ]);
  }
  if (userId) {
    const followRows = await supabaseSelect("follows", session?.access_token, `select=following_id&follower_id=eq.${userId}`);
    followingIds = new Set(followRows.map((f) => f.following_id));
    const voteRows = await supabaseSelect("contest_votes", session?.access_token, `select=id&voter_id=eq.${userId}&voted_on=eq.${todayStr()}`);
    hasVotedToday = voteRows.length > 0;
    // Savunmacı istemci filtresi: asil garanti artik posts_select RLS'i
    // (bkz. 006_posts_visibility_block_check - iki yonlu engel, contest
    // istisnasi dahil TUM gorunurlugu kapsiyor). Bu, sadece onceden
    // yuklenmis/gecikmis bir listede kalan karti da yakalayan ek bir
    // katman - iki yonlu (blocked_among), tek yonlu "sadece kendi
    // blokladiklarim" yerine.
    const authorIds = [...new Set(rows.map((r) => r.author_id))];
    if (authorIds.length > 0) {
      const blockedRows = await supabaseRpc("blocked_among", session?.access_token, { candidate_ids: authorIds }).catch(() => []);
      blockedIds = new Set((blockedRows || []).map((b) => b.blocked_id));
    }
  }
  return rows
    .filter((r) => !blockedIds.has(r.author_id))
    .map((r) => {
    // Asama 2 gecisi: pet baglantisi hem eski posts.pet_id/pets (fallback)
    // hem yeni post_pets uzerinden okunuyor, ayni pet iki kaynaktan da
    // gelirse id'ye gore tekillestiriliyor.
    const linkedPets = (r.post_pets || []).map((pp) => pp.pets).filter(Boolean);
    const petMap = new Map();
    [r.pets, ...linkedPets].forEach((p) => {
      if (p && p.id) petMap.set(p.id, p);
    });
    const pets = Array.from(petMap.values());
    return {
    id: r.id,
    authorId: r.author_id,
    isMine: r.author_id === userId,
    human: r.profiles?.display_name || "Kullanıcı",
    pets,
    pet: pets.map((p) => p.name).join(" & ") || "Dost",
    petEmoji: pets[0]?.emoji || "🐾",
    imageUrl: r.image_url,
    caption: r.caption,
    contest: r.contest_category,
    likeCount: likeRows.filter((l) => l.post_id === r.id).length,
    likedByMe: likeRows.some((l) => l.post_id === r.id && l.user_id === userId),
    commentCount: commentRows.filter((c) => c.post_id === r.id).length,
    isFollowing: followingIds.has(r.author_id),
    hasVotedToday,
    tag: null,
    };
  });
}

async function updateStreakAfterVote(session, userId) {
  const now = new Date();
  const today = todayStr();
  const dayOfMonth = now.getUTCDate();
  let existing = null;
  try {
    const rows = await supabaseSelect("vote_streaks", session.access_token, `select=current_month_votes,last_vote_date&user_id=eq.${userId}`);
    existing = rows[0] || null;
  } catch (e) {}
  let sameMonth = false;
  if (existing?.last_vote_date) {
    const last = new Date(existing.last_vote_date);
    sameMonth = last.getUTCFullYear() === now.getUTCFullYear() && last.getUTCMonth() === now.getUTCMonth();
  }
  const newVotes = sameMonth ? existing.current_month_votes + 1 : 1;
  const badgeEarned = newVotes >= dayOfMonth;
  await supabaseUpsert(
    "vote_streaks",
    session.access_token,
    { user_id: userId, current_month_votes: newVotes, last_vote_date: today, badge_earned: badgeEarned },
    "user_id"
  );
  return { currentMonthVotes: newVotes, badgeEarned };
}

export function PostCard({ post, session, userId, myName, onOpenComplaint, onOpenComments, onOpenProfile, isGuest, onRequireAuth, onStreakUpdate }) {
  const petsLabel =
    post.pets && post.pets.length > 0
      ? post.pets.map((p) => `${p.emoji || "🐾"} ${p.name}`).join(" & ")
      : `🐾 Dost`;
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [voted, setVoted] = useState(!!post.hasVotedToday);
  const [voteError, setVoteError] = useState("");
  const [voting, setVoting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const { followState, followLabel, disabled: followDisabled, toggleFollow } = useHumanFollow({
    session,
    userId,
    targetId: post.authorId,
    isGuest,
    onRequireAuth,
  });

  const castVote = async () => {
    if (isGuest) return onRequireAuth();
    if (voted || voting) return;
    setVoting(true);
    setVoteError("");
    try {
      await supabaseInsert("contest_votes", session.access_token, { post_id: post.id, voter_id: userId, voted_on: todayStr() });
      setVoted(true);
      const streak = await updateStreakAfterVote(session, userId);
      onStreakUpdate && onStreakUpdate(streak);
    } catch (e) {
      setVoted(true);
      setVoteError("Bugün zaten oy kullandın");
    } finally {
      setVoting(false);
    }
  };

  const toggleLike = async () => {
    if (isGuest) return onRequireAuth();
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => (next ? c + 1 : c - 1));
    try {
      if (next) await supabaseInsert("likes", session.access_token, { post_id: post.id, user_id: userId });
      else await supabaseDelete("likes", session.access_token, `post_id=eq.${post.id}&user_id=eq.${userId}`);
    } catch (e) {
      setLiked(!next);
      setLikeCount((c) => (next ? c - 1 : c + 1));
    }
  };

  if (blocked) {
    return (
      <div
        style={{
          background: C.cream,
          borderRadius: 20,
          border: `1px solid ${C.line}`,
          marginBottom: 16,
          padding: "18px 16px",
          textAlign: "center",
          fontFamily: FONT_BODY,
          fontSize: 13,
          color: C.inkSoft,
        }}
      >
        {post.human} engellendi, gönderileri artık görünmeyecek.
      </div>
    );
  }

  return (
    <div style={{ background: C.cream, borderRadius: 20, border: `1px solid ${C.line}`, marginBottom: 16, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        <div
          onClick={() => !post.isMine && onOpenProfile && onOpenProfile(post)}
          style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: post.isMine ? "default" : "pointer" }}
        >
          <BlobAvatar emoji={post.petEmoji} color={C.mustard} />
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 14, color: C.ink }}>{petsLabel}</div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 12, color: C.inkSoft }}>{post.human}</div>
          </div>
        </div>
        {post.contest && <PawBadge color={C.mustard}>🏆 {post.contest}</PawBadge>}
        {!post.isMine && (
          <button
            onClick={toggleFollow}
            disabled={followDisabled}
            style={{
              background: followState === "none" ? C.pine : C.cream,
              color: followState === "none" ? C.cream : C.pine,
              border: `1.5px solid ${C.pine}`,
              borderRadius: 10,
              padding: "5px 10px",
              fontFamily: FONT_DISPLAY,
              fontSize: 11.5,
              cursor: followDisabled ? "default" : "pointer",
              whiteSpace: "nowrap",
              opacity: followDisabled ? 0.6 : 1,
            }}
          >
            {followLabel}
          </button>
        )}
        {!post.isMine && (
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenuOpen((v) => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft, fontSize: 18, padding: "0 4px" }}>
              ⋯
            </button>
            {menuOpen && (
              <div style={{ position: "absolute", right: 0, top: 26, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 6px 18px rgba(0,0,0,0.08)", zIndex: 10, minWidth: 150 }}>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenComplaint(post.id);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", background: "none", border: "none", cursor: "pointer", fontFamily: FONT_BODY, fontSize: 13, color: C.coral, textAlign: "left" }}
                >
                  <Flag size={14} /> Şikayet et
                </button>
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    setBlocked(true);
                    try {
                      await supabaseInsert("blocks", session.access_token, { blocker_id: userId, blocked_id: post.authorId });
                    } catch (e) {}
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 12px", background: "none", border: "none", borderTop: `1px solid ${C.line}`, cursor: "pointer", fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft, textAlign: "left" }}
                >
                  <X size={14} /> Engelle
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {post.imageUrl && (
        <ResolvedImage
          path={post.imageUrl}
          kind="post"
          session={session}
          userId={userId}
          alt={post.caption}
          style={{ width: "100%", maxHeight: 420, objectFit: "contain", display: "block", background: C.paper }}
        />
      )}

      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
          <button onClick={toggleLike} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <Heart size={22} color={liked ? C.coral : C.inkSoft} fill={liked ? C.coral : "none"} strokeWidth={2} />
            <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13, color: C.inkSoft }}>{likeCount}</span>
          </button>
          <div
            onClick={() => (isGuest ? onRequireAuth() : onOpenComments ? onOpenComments() : setShowComments(true))}
            style={{ display: "flex", alignItems: "center", gap: 5, color: C.inkSoft, cursor: "pointer" }}
          >
            <MessageCircle size={20} />
            <span style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 13 }}>{commentCount}</span>
          </div>

          {post.contest && (
            <button
              onClick={castVote}
              disabled={voted || voting}
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: voted ? "#EFEAE0" : C.mustard,
                color: voted ? C.inkSoft : C.cream,
                border: "none",
                borderRadius: 10,
                padding: "7px 12px",
                fontFamily: FONT_DISPLAY,
                fontSize: 12.5,
                cursor: voted ? "default" : "pointer",
              }}
            >
              <Trophy size={14} />
              {voting ? "..." : voted ? "Oy verildi" : "Oy ver"}
            </button>
          )}
        </div>
        {voteError && (
          <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.coral, marginBottom: 8 }}>{voteError}</div>
        )}
        {post.imageUrl ? (
          <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.ink, lineHeight: 1.4 }}>
            <span style={{ fontWeight: 800 }}>{petsLabel}</span> — {post.caption}
          </div>
        ) : (
          <div style={{ fontFamily: FONT_BODY, fontSize: 16, color: C.ink, lineHeight: 1.5 }}>{post.caption}</div>
        )}
      </div>

      {showComments && (
        <CommentsModal
          post={post}
          session={session}
          userId={userId}
          myName={myName}
          onClose={() => setShowComments(false)}
          onCommentAdded={() => setCommentCount((c) => c + 1)}
        />
      )}

    </div>
  );
}

export function FeedScreen({ session, userId, myName, onOpenComplaint, onOpenProfile, onCompose, onOpenSearch, onOpenInbox, myFirstPet, isGuest, onRequireAuth, refreshKey }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [streak, setStreak] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    loadFeed(session, userId)
      .then((rows) => active && setPosts(rows))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [refreshKey, userId]);

  useEffect(() => {
    if (!userId) return;
    supabaseSelect("vote_streaks", session?.access_token, `select=current_month_votes,badge_earned&user_id=eq.${userId}`)
      .then((rows) => rows[0] && setStreak({ currentMonthVotes: rows[0].current_month_votes, badgeEarned: rows[0].badge_earned }))
      .catch(() => {});
    supabaseCount("messages", session?.access_token, `select=id&recipient_id=eq.${userId}&read=eq.false`)
      .then(setUnreadCount)
      .catch(() => {});
  }, [userId, refreshKey]);

  return (
    <div>
      <TopBar
        title={<FlickletLogo />}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => (isGuest ? onRequireAuth() : onOpenSearch())} style={{ background: "none", border: "none", cursor: "pointer", color: C.ink, padding: 0, display: "flex" }}>
              <Search size={19} />
            </button>
            <button onClick={() => (isGuest ? onRequireAuth() : onOpenInbox())} style={{ background: "none", border: "none", cursor: "pointer", color: C.ink, padding: 0, display: "flex", position: "relative" }}>
              <Mail size={19} />
              {!isGuest && unreadCount > 0 && <div style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: C.coral }} />}
            </button>
            {!isGuest && streak && streak.currentMonthVotes > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: streak.badgeEarned ? C.mustard : C.pine }}>
                <Flame size={16} />
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 12 }}>{streak.currentMonthVotes}</span>
              </div>
            )}
          </div>
        }
      />

      <div className="fl-col fl-hide-desktop" style={{ padding: "14px 14px 4px" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 12.5, color: C.inkSoft, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>🔥 Gündemde</div>
        <TrendingSection layout="horizontal" />
      </div>

      <div className="fl-col" style={{ padding: "0 14px" }}>
        <div
          onClick={() => (isGuest ? onRequireAuth() : onCompose())}
          style={{ display: "flex", alignItems: "center", gap: 10, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 16, padding: "10px 12px", marginBottom: 6, cursor: "pointer" }}
        >
          <BlobAvatar emoji={myFirstPet?.emoji || "🐾"} size={36} color={C.mustard} />
          <div style={{ flex: 1, fontFamily: FONT_BODY, fontSize: 13.5, color: C.inkSoft, padding: "9px 14px", background: C.paper, borderRadius: 20 }}>
            Flick at, nasıl olduğunu paylaş 🐾
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "40% 60% 60% 40% / 45% 45% 55% 55%", background: C.mustard, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Plus size={17} color={C.cream} />
          </div>
        </div>
      </div>

      {isGuest && (
        <div className="fl-col" style={{ padding: "0 14px" }}>
          <div
            onClick={onRequireAuth}
            style={{ margin: "4px 0 0", background: C.mustard, color: C.cream, borderRadius: 14, padding: "11px 14px", fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textAlign: "center" }}
          >
            👀 Şu an gözatıyorsun — beğenmek, oy vermek ve paylaşmak için üye ol
          </div>
        </div>
      )}

      <div className="fl-col" style={{ padding: "16px 14px 90px" }}>
        {loading && <LoadingState />}
        {!loading && error && <ErrorBanner style={{ padding: "12px 14px" }}>{error}</ErrorBanner>}
        {!loading && !error && posts.length === 0 && <EmptyState>Henüz gönderi yok — ilk flick'i sen at 🐾</EmptyState>}
        {posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            session={session}
            userId={userId}
            myName={myName}
            onOpenComplaint={isGuest ? onRequireAuth : onOpenComplaint}
            onOpenProfile={onOpenProfile}
            isGuest={isGuest}
            onRequireAuth={onRequireAuth}
            onStreakUpdate={setStreak}
          />
        ))}
      </div>
    </div>
  );
}

export { loadFeed };
