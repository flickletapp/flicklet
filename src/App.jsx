import { useState } from "react";
import { C, FONT_BODY } from "./theme";
import { useAuth } from "./features/auth/useAuth";
import { AuthScreen } from "./features/auth/Auth";
import { ProfileSetupScreen } from "./features/auth/ProfileSetup";
import { FeedScreen } from "./features/posts/Feed";
import { CreatePostScreen } from "./features/posts/CreatePost";
import { DiscoverScreen } from "./features/posts/Discover";
import { ContestScreen } from "./features/contests/Contest";
import { ProfileScreen } from "./features/profiles/Profile";
import { UserProfileView } from "./features/profiles/UserProfileView";
import { SearchScreen } from "./features/profiles/Search";
import { InboxScreen } from "./features/messages/Inbox";
import { ChatScreen } from "./features/messages/Chat";
import { NavBar } from "./components/ui";
import { ComplaintModal, SignupPromptModal } from "./components/modals";

export default function FlickletApp() {
  const auth = useAuth();
  const [tab, setTab] = useState("feed");
  const [complaintPostId, setComplaintPostId] = useState(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [searching, setSearching] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  const requireAuth = () => setPromptOpen(true);

  const handleLogout = () => {
    auth.handleLogout();
    setTab("feed");
  };

  const { phase, session, userId, user, isPrivate, myPets, isGuest } = auth;

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
      {phase === "auth" && <AuthScreen onDone={auth.handleAuthDone} onGuest={auth.enterGuestMode} />}
      {phase === "setup" && <ProfileSetupScreen session={session} userId={userId} onDone={auth.completeOnboarding} />}
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
              setIsPrivate={auth.setIsPrivate}
              onOpenProfile={(p) => setViewingProfile(p)}
              onLogout={handleLogout}
              onAddPet={auth.addPet}
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
            auth.goToSignup();
          }}
        />
      )}
    </div>
  );
}
