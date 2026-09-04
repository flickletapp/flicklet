import { useEffect, useState } from "react";
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
import { NavBar, DesktopSideNav, TrendingSection } from "./components/ui";
import { ComplaintModal, SignupPromptModal } from "./components/modals";

// Ana bottom-nav/side-nav sekmeleri - tek gecerli kaynak. Baska hicbir
// yerde bu liste ayrica yazilmiyor; gecersiz/eksik ?tab= degeri hep
// "feed"e duser.
const TABS = ["feed", "contest", "discover", "profile"];

function readTabFromUrl() {
  try {
    const t = new URL(window.location.href).searchParams.get("tab");
    return TABS.includes(t) ? t : "feed";
  } catch {
    return "feed";
  }
}

// Digim query parametrelerine ve hash'e dokunmadan sadece "tab"i
// gunceller/kaldirir (feed = URL'de hic tab parametresi olmamasi).
function urlWithTab(tab) {
  const url = new URL(window.location.href);
  if (tab === "feed") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", tab);
  }
  return url;
}

export default function FlickletApp() {
  const auth = useAuth();
  const [tab, setTabState] = useState(readTabFromUrl);
  const [complaintPostId, setComplaintPostId] = useState(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [searching, setSearching] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);

  // Normal sekme degisimi (nav tiklamasi, yayinlama sonrasi Akis'a
  // donus vb.) - URL'e YENI bir gecmis girdisi ekler. Ayni sekmeye
  // tekrar basilirsa (next === tab) gecmisi sismemesi icin hicbir
  // history cagrisi yapilmaz.
  const navigateTab = (key) => {
    const next = TABS.includes(key) ? key : "feed";
    if (next === tab) return;
    setTabState(next);
    window.history.pushState(null, "", urlWithTab(next).toString());
  };

  // Cikis/sifirlama durumu - gecmise YENI girdi eklemez, mevcut
  // girdinin yerini alir. Boylece cikistan sonra geri tusu, oturum
  // acikken ziyaret edilmis korumali bir sekmeyi yeniden acmaya
  // calismaz (render zaten phase==="app" olmadan hicbir sekmeyi
  // gostermiyor, ama URL de feed'e sifirlanir).
  const resetTabUrl = () => {
    setTabState("feed");
    window.history.replaceState(null, "", urlWithTab("feed").toString());
  };

  // Tarayici geri/ileri tuslari: URL zaten degismis olur, sadece
  // state'i ona gore senkronize et - yeni bir history girdisi EKLEME.
  useEffect(() => {
    const onPopState = () => setTabState(readTabFromUrl());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const requireAuth = () => setPromptOpen(true);

  const handleLogout = () => {
    auth.handleLogout();
    resetTabUrl();
  };

  const { phase, session, userId, user, isPrivate, myPets, isGuest } = auth;

  return (
    <div style={{ minHeight: "100vh", background: C.paper, color: C.ink, fontFamily: FONT_BODY }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600&family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        html, body { overflow-x: hidden; }
        input:focus { border-color: ${C.mustard} !important; }
        ::-webkit-scrollbar { display: none; }

        /* Ana içerik sütunu: telefon 480px, tablet 640px, masaüstü 720px
           (ortada 650-750px hedefine uyar). Bottom-sheet/modal genişlikleri
           bilinçli olarak 480px'te sabit bırakıldı, bu sınıfa dahil değil. */
        .fl-col {
          max-width: 480px;
          margin: 0 auto;
          width: 100%;
        }
        @media (min-width: 640px) {
          .fl-col { max-width: 640px; }
        }
        @media (min-width: 1024px) {
          .fl-col { max-width: 720px; }
        }

        .fl-hide-desktop { }
        @media (min-width: 1024px) {
          .fl-hide-desktop { display: none !important; }
        }

        /* Alt mobil navigasyon: telefon/tablette 480/640px'te ortalanır,
           masaüstünde (sol dikey menü onun yerini alır) gizlenir. */
        .fl-navbar {
          max-width: 480px;
          margin: 0 auto;
        }
        @media (min-width: 640px) {
          .fl-navbar { max-width: 640px; }
        }
        @media (min-width: 1024px) {
          .fl-navbar { display: none !important; }
        }

        /* Masaüstü (>=1024px) 3 sütunlu kabuk: sol sabit menü, ortada
           650-750px ana akış, sağda "Gündemde". Toplam ~1200-1400px
           kullanılabilir alanda ortalanır. */
        .fl-sidenav { display: none; }
        .fl-trending { display: none; }
        @media (min-width: 1024px) {
          .fl-shell {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            gap: 28px;
            max-width: 1360px;
            margin: 0 auto;
            padding: 0 24px;
          }
          .fl-sidenav {
            display: flex;
            flex-direction: column;
            gap: 4px;
            position: sticky;
            top: 24px;
            width: 220px;
            flex: 0 0 220px;
            align-self: flex-start;
          }
          .fl-main {
            width: 720px;
            max-width: 720px;
            flex: 0 0 720px;
            min-width: 0;
          }
          .fl-trending {
            display: block;
            position: sticky;
            /* TopBar'in (~56px) hemen altinda, ana akisla ayni hizada
               baslasin - ekranin tam tepesine yapismasin (bkz. tepe
               yapismasi sikayeti). max-height + overflow, uzun icerikte
               sayfanin geri kalanini bos birakmadan sadece kendi
               icinde kaydirilmasini, kisa icerikte ise (mevcut durum)
               olmasi gereken boyutta kalmasini saglar - ekran
               yuksekligine zorla uzatilmiyor. */
            top: 88px;
            width: 300px;
            flex: 0 0 300px;
            align-self: flex-start;
            max-height: calc(100vh - 112px);
            overflow-y: auto;
          }
        }

        /* Sol menudeki amblem butonu: konum/boyut degismesin diye
           padding yok, sadece imleç + cok hafif opaklik tepkisi.
           Amblemin sekli ve renkleri degistirilmiyor. Tiklama alani
           amblemin kendisi = 52x52 px (>= 44x44 gereksinimi). */
        .fl-logo-btn {
          background: none;
          border: none;
          padding: 0;
          margin: 0;
          display: block;
          line-height: 0;
          cursor: pointer;
          border-radius: 12px;
          transition: opacity 0.12s ease;
        }
        .fl-logo-btn:hover { opacity: 0.85; }
        .fl-logo-btn:active { opacity: 0.72; }
        .fl-logo-btn:focus-visible {
          outline: 2px solid ${C.pine};
          outline-offset: 3px;
        }

        /* Takipci/Takip listesi (ve benzeri) modal: telefonda alt sayfa
           (bottom-sheet, degismedi), tablet/masaustunde (>=768px)
           ekranin ortasinda sabit genislikte modal. Baslik+kapat sabit,
           sadece ic liste kaydiriliyor (bkz. FollowListModal). */
        .fl-modal-backdrop {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 50;
        }
        .fl-modal-panel {
          width: 100%;
          max-width: 480px;
          max-height: 70vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 22px 22px 0 0;
        }
        @media (min-width: 768px) {
          .fl-modal-backdrop {
            align-items: center;
            padding: 24px;
            box-sizing: border-box;
          }
          .fl-modal-panel {
            max-width: 520px;
            max-height: 80vh;
            border-radius: 20px;
          }
        }
      `}</style>

      {phase === "loading" && (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src="/favicon.png" alt="" style={{ width: 48, height: 48, opacity: 0.6 }} />
        </div>
      )}
      {phase === "auth" && <AuthScreen onDone={auth.handleAuthDone} onGuest={auth.enterGuestMode} />}
      {phase === "setup" && <ProfileSetupScreen session={session} userId={userId} onDone={auth.completeOnboarding} />}
      {phase === "app" && !creating && !viewingProfile && !searching && !inboxOpen && !activeChat && (
        <div className="fl-shell">
          <DesktopSideNav tab={tab} setTab={navigateTab} isGuest={isGuest} onRequireAuth={requireAuth} onAdd={() => setCreating(true)} />
          <div className="fl-main">
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
                onUpdateUserName={auth.updateUserName}
              />
            )}
            <NavBar tab={tab} setTab={navigateTab} isGuest={isGuest} onRequireAuth={requireAuth} onAdd={() => setCreating(true)} />
          </div>
          <aside className="fl-trending">
            <TrendingSection layout="vertical" />
          </aside>
        </div>
      )}
      {phase === "app" && creating && (
        <CreatePostScreen
          myPets={myPets}
          session={session}
          userId={userId}
          onPublish={() => {
            setCreating(false);
            navigateTab("feed");
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
          userId={userId}
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
