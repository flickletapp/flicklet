import { useEffect, useState } from "react";
import { C, FONT_BODY } from "./theme";
import { supabaseGetUser, supabaseSelect } from "./lib/supabaseClient";

const SESSION_KEY = "flicklet_session";
import { AuthScreen } from "./screens/Auth";
import { ProfileSetupScreen } from "./screens/ProfileSetup";
import { FeedScreen } from "./screens/Feed";
import { CreatePostScreen } from "./screens/CreatePost";
import { DiscoverScreen } from "./screens/Discover";
import { ContestScreen } from "./screens/Contest";
import { ProfileScreen } from "./screens/Profile";
import { UserProfileView } from "./screens/UserProfileView";
import { SearchScreen } from "./screens/Search";
import { InboxScreen } from "./screens/Inbox";
import { ChatScreen } from "./screens/Chat";
import { NavBar } from "./components/ui";
import { ComplaintModal, SignupPromptModal } from "./components/modals";

export default function FlickletApp() {
  const [phase, setPhase] = useState("loading"); // loading -> auth -> setup -> app
  const [tab, setTab] = useState("feed");
  const [user, setUser] = useState({ name: "" });
  const [isPrivate, setIsPrivate] = useState(false);
  const [complaintPostId, setComplaintPostId] = useState(null);
  const [myPets, setMyPets] = useState([]);
  const [isGuest, setIsGuest] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [session, setSession] = useState(null);
  const [userId, setUserId] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [searching, setSearching] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  const requireAuth = () => setPromptOpen(true);

  const bootstrapSession = async (sessionData) => {
    setSession(sessionData);
    try {
      const u = await supabaseGetUser(sessionData.access_token);
      setUserId(u.id);
      // Onboarding tamamlanma durumu profiles.display_name doluluğuna bağlı,
      // pet sayısına değil — pet eklemek zorunlu değil (bkz. flicklet_stage0_audit P0).
      const [profileRows, existingPets] = await Promise.all([
        supabaseSelect("profiles", sessionData.access_token, `select=display_name,is_private&id=eq.${u.id}`),
        supabaseSelect("pets", sessionData.access_token, `select=id,name,species,emoji&owner_id=eq.${u.id}`),
      ]);
      const displayName = profileRows[0]?.display_name;
      if (displayName) {
        setUser({ name: displayName });
        setIsPrivate(!!profileRows[0]?.is_private);
        setMyPets(existingPets);
        setPhase("app");
        return;
      }
      setPhase("setup");
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      setSession(null);
      setPhase("auth");
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) {
      setPhase("auth");
      return;
    }
    try {
      bootstrapSession(JSON.parse(saved));
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      setPhase("auth");
    }
  }, []);

  const handleAuthDone = async (sessionData) => {
    if (sessionData?.access_token) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      await bootstrapSession(sessionData);
      return;
    }
    setPhase("setup");
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setUserId(null);
    setUser({ name: "" });
    setMyPets([]);
    setIsGuest(false);
    setTab("feed");
    setPhase("auth");
  };

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: FONT_BODY }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input:focus { border-color: ${C.mustard} !important; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {phase === "loading" && (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src="/favicon.png" alt="" style={{ width: 48, height: 48, opacity: 0.6 }} />
        </div>
      )}
      {phase === "auth" && (
        <AuthScreen
          onDone={handleAuthDone}
          onGuest={() => {
            setIsGuest(true);
            setPhase("app");
          }}
        />
      )}
      {phase === "setup" && (
        <ProfileSetupScreen
          session={session}
          userId={userId}
          onDone={(profileData) => {
            setIsGuest(false);
            if (profileData?.name) setUser({ name: profileData.name });
            if (profileData?.pets) setMyPets(profileData.pets);
            setPhase("app");
          }}
        />
      )}
      {phase === "app" && !creating && !viewingProfile && !searching && !inboxOpen && !activeChat && (
        <>
          {tab === "feed" && (
            <FeedScreen
              session={session}
              userId={userId}
              myName={user.name}
              refreshKey={feedRefreshKey}
              onOpenComplaint={(postId) => setComplaintPostId(postId)}
              onOpenProfile={(p) => setViewingProfile(p)}
              onCompose={() => setCreating(true)}
              onOpenSearch={() => setSearching(true)}
              onOpenInbox={() => setInboxOpen(true)}
              myFirstPet={myPets[0]}
              isGuest={isGuest}
              onRequireAuth={requireAuth}
            />
          )}
          {tab === "contest" && (
            <ContestScreen session={session} userId={userId} isGuest={isGuest} onRequireAuth={requireAuth} />
          )}
          {tab === "discover" && (
            <DiscoverScreen
              session={session}
              userId={userId}
              myName={user.name}
              refreshKey={feedRefreshKey}
              onOpenProfile={(p) => setViewingProfile(p)}
              onOpenComplaint={(postId) => setComplaintPostId(postId)}
              isGuest={isGuest}
              onRequireAuth={requireAuth}
            />
          )}
          {tab === "profile" && (
            <ProfileScreen
              session={session}
              userId={userId}
              user={user}
              myPets={myPets}
              isPrivate={isPrivate}
              setIsPrivate={setIsPrivate}
              onOpenProfile={(p) => setViewingProfile(p)}
              onLogout={handleLogout}
            />
          )}
          <NavBar tab={tab} setTab={setTab} isGuest={isGuest} onRequireAuth={requireAuth} onAdd={() => setCreating(true)} />
        </>
      )}
      {phase === "app" && creating && (
        <CreatePostScreen
          myPets={myPets}
          session={session}
          userId={userId}
          onPublish={() => {
            setCreating(false);
            setTab("feed");
            setFeedRefreshKey((k) => k + 1);
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      {phase === "app" && viewingProfile && !activeChat && (
        <UserProfileView
          target={viewingProfile}
          session={session}
          userId={userId}
          onBack={() => setViewingProfile(null)}
          onOpenProfile={(p) => setViewingProfile(p)}
          onOpenChat={(c) => setActiveChat(c)}
          isGuest={isGuest}
          onRequireAuth={requireAuth}
        />
      )}
      {phase === "app" && searching && (
        <SearchScreen
          session={session}
          onBack={() => setSearching(false)}
          onOpenProfile={(u) => {
            setSearching(false);
            setViewingProfile(u);
          }}
        />
      )}
      {phase === "app" && inboxOpen && !activeChat && (
        <InboxScreen session={session} userId={userId} onBack={() => setInboxOpen(false)} onOpenChat={(c) => setActiveChat(c)} />
      )}
      {phase === "app" && activeChat && (
        <ChatScreen conversation={activeChat} session={session} userId={userId} onBack={() => setActiveChat(null)} />
      )}

      {complaintPostId && (
        <ComplaintModal postId={complaintPostId} session={session} userId={userId} onClose={() => setComplaintPostId(null)} />
      )}
      {promptOpen && (
        <SignupPromptModal
          onClose={() => setPromptOpen(false)}
          onSignup={() => {
            setPromptOpen(false);
            setIsGuest(false);
            setPhase("auth");
          }}
        />
      )}
    </div>
  );
}
