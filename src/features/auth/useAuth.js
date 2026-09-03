import { useEffect, useState } from "react";
import { supabaseGetUser, supabaseSelect } from "../../lib/supabase/client";

const SESSION_KEY = "flicklet_session";

// Uygulamanın tüm auth durumunu (oturum, kullanıcı, profil, misafir modu) tek
// merkezden yönetir. Davranış App.jsx'te önceden olduğu gibi korunur.
export function useAuth() {
  const [phase, setPhase] = useState("loading"); // loading -> auth -> setup -> app
  const [session, setSession] = useState(null);
  const [userId, setUserId] = useState(null);
  const [user, setUser] = useState({ name: "" });
  const [isPrivate, setIsPrivate] = useState(false);
  const [myPets, setMyPets] = useState([]);
  const [isGuest, setIsGuest] = useState(false);

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
    setPhase("auth");
  };

  const enterGuestMode = () => {
    setIsGuest(true);
    setPhase("app");
  };

  const completeOnboarding = (profileData) => {
    setIsGuest(false);
    if (profileData?.name) setUser({ name: profileData.name });
    if (profileData?.pets) setMyPets(profileData.pets);
    setPhase("app");
  };

  const goToSignup = () => {
    setIsGuest(false);
    setPhase("auth");
  };

  const addPet = (pet) => {
    setMyPets((cur) => [...cur, pet]);
  };

  const updateUserName = (name) => {
    setUser({ name });
  };

  return {
    phase,
    session,
    userId,
    user,
    isPrivate,
    myPets,
    isGuest,
    setIsPrivate,
    handleAuthDone,
    handleLogout,
    enterGuestMode,
    completeOnboarding,
    goToSignup,
    addPet,
    updateUserName,
  };
}
