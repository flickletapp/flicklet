import { useEffect, useState } from "react";
import { supabaseSelect, supabaseInsert, supabaseDelete } from "../../lib/supabase/client";

// Insan profili takip akisi (UserProfileView ve Feed'in post karti arasinda
// paylasilan ortak mantik): acik profilde dogrudan follows, kapali profilde
// follow_requests (pet_id=null) ile pending istek. Pet takibi/istek kabul
// akisina dokunmaz - o Asama 7'nin isi.
export function useHumanFollow({ session, userId, targetId, isGuest, onRequireAuth, onFollowChange }) {
  const [followState, setFollowState] = useState("none"); // "none" | "pending" | "following"
  const [targetIsPrivate, setTargetIsPrivate] = useState(null); // null = henuz yuklenmedi
  const isSelf = !!userId && userId === targetId;

  useEffect(() => {
    if (!targetId) return;
    supabaseSelect("profiles", session?.access_token, `select=is_private&id=eq.${targetId}`)
      .then((rows) => setTargetIsPrivate(!!rows[0]?.is_private))
      .catch(() => {});
    if (userId && !isSelf) {
      supabaseSelect("follows", session?.access_token, `select=follower_id&follower_id=eq.${userId}&following_id=eq.${targetId}`)
        .then((rows) => {
          if (rows.length > 0) {
            setFollowState("following");
            return;
          }
          return supabaseSelect(
            "follow_requests",
            session?.access_token,
            `select=id&requester_id=eq.${userId}&target_id=eq.${targetId}&pet_id=is.null&status=eq.pending`
          ).then((reqRows) => setFollowState(reqRows.length > 0 ? "pending" : "none"));
        })
        .catch(() => {});
    }
  }, [targetId, userId]);

  const toggleFollow = async () => {
    if (isGuest) return onRequireAuth();
    if (isSelf) return;
    // Gizlilik bilgisi henuz yuklenmediyse (veya sorgu hata verdiyse)
    // dogrudan takip/istek karari verilemez - islem yapma.
    if (targetIsPrivate === null) return;

    if (followState === "following") {
      setFollowState("none");
      try {
        await supabaseDelete("follows", session.access_token, `follower_id=eq.${userId}&following_id=eq.${targetId}`);
        // Sadece gercek follows kaydi silindiginde (dogrudan takipten
        // cikma) sayaci azalt - pending istek iptalinde bu koldan gecilmez.
        onFollowChange && onFollowChange(-1);
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
          `requester_id=eq.${userId}&target_id=eq.${targetId}&pet_id=is.null&status=eq.pending`
        );
      } catch (e) {
        setFollowState("pending");
      }
      return;
    }

    if (targetIsPrivate) {
      setFollowState("pending");
      try {
        await supabaseInsert("follow_requests", session.access_token, { requester_id: userId, target_id: targetId });
      } catch (e) {
        setFollowState("none");
      }
    } else {
      setFollowState("following");
      try {
        await supabaseInsert("follows", session.access_token, { follower_id: userId, following_id: targetId });
        // Sadece dogrudan follows insert'i basarili oldugunda (acik
        // profil) sayaci artir - kapali profilde bu kola hic girilmiyor,
        // sadece pending istek olusuyor, sayac degismiyor.
        onFollowChange && onFollowChange(1);
      } catch (e) {
        setFollowState("none");
      }
    }
  };

  const followLabel = followState === "following" ? "Takip ediliyor" : followState === "pending" ? "İstek gönderildi" : "Takip Et";

  return { followState, followLabel, isSelf, disabled: targetIsPrivate === null, toggleFollow };
}
