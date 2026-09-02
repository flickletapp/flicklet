import { useEffect, useState } from "react";
import { supabaseSelect, supabaseInsert, supabaseDelete } from "../../lib/supabase/client";

// Bagimsiz pet takip akisi (bkz. useHumanFollow - ayni desen, pet_follows/
// follow_requests(pet_id=X) uzerinden). Sahip acikken dogrudan pet_follows,
// kapaliyken follow_requests. Insan takip akisina dokunmaz.
export function usePetFollow({ session, userId, petId, ownerId, isGuest, onRequireAuth }) {
  const [followState, setFollowState] = useState("none"); // "none" | "pending" | "following"
  const [ownerIsPrivate, setOwnerIsPrivate] = useState(null); // null = henuz yuklenmedi
  const isOwn = !!userId && userId === ownerId;

  useEffect(() => {
    if (!petId || !ownerId) return;
    supabaseSelect("profiles", session?.access_token, `select=is_private&id=eq.${ownerId}`)
      .then((rows) => setOwnerIsPrivate(!!rows[0]?.is_private))
      .catch(() => {});
    if (userId && !isOwn) {
      supabaseSelect("pet_follows", session?.access_token, `select=follower_id&follower_id=eq.${userId}&pet_id=eq.${petId}`)
        .then((rows) => {
          if (rows.length > 0) {
            setFollowState("following");
            return;
          }
          return supabaseSelect(
            "follow_requests",
            session?.access_token,
            `select=id&requester_id=eq.${userId}&pet_id=eq.${petId}&status=eq.pending`
          ).then((reqRows) => setFollowState(reqRows.length > 0 ? "pending" : "none"));
        })
        .catch(() => {});
    }
  }, [petId, ownerId, userId]);

  const toggleFollow = async () => {
    if (isGuest) return onRequireAuth();
    if (isOwn) return;
    // Sahibin gizlilik durumu (veya mevcut takip/istek durumu) henuz
    // yuklenmediyse dogrudan takip/istek karari verilemez.
    if (ownerIsPrivate === null) return;

    if (followState === "following") {
      setFollowState("none");
      try {
        await supabaseDelete("pet_follows", session.access_token, `follower_id=eq.${userId}&pet_id=eq.${petId}`);
      } catch (e) {
        setFollowState("following");
      }
      return;
    }

    if (followState === "pending") {
      setFollowState("none");
      try {
        await supabaseDelete("follow_requests", session.access_token, `requester_id=eq.${userId}&pet_id=eq.${petId}&status=eq.pending`);
      } catch (e) {
        setFollowState("pending");
      }
      return;
    }

    if (ownerIsPrivate) {
      setFollowState("pending");
      try {
        await supabaseInsert("follow_requests", session.access_token, { requester_id: userId, target_id: ownerId, pet_id: petId });
      } catch (e) {
        setFollowState("none");
      }
    } else {
      setFollowState("following");
      try {
        await supabaseInsert("pet_follows", session.access_token, { follower_id: userId, pet_id: petId });
      } catch (e) {
        setFollowState("none");
      }
    }
  };

  const followLabel = followState === "following" ? "Pet takip ediliyor" : followState === "pending" ? "İstek gönderildi" : "Peti takip et";

  return { followState, followLabel, isOwn, disabled: ownerIsPrivate === null, toggleFollow };
}
