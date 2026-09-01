import { useState } from "react";
import { C, FONT_DISPLAY, FONT_BODY } from "../theme";
import { TextField, PrimaryButton } from "../components/ui";
import { supabaseUpdate, supabaseInsert } from "../lib/supabase/client";

export function ProfileSetupScreen({ onDone, session, userId }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState("cat");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const petEmoji = { cat: "🐱", dog: "🐶", other: "🐾" }[petType];

  const saveNameAndContinue = async () => {
    setError("");
    if (!session || !userId) {
      setStep(2);
      return;
    }
    setLoading(true);
    try {
      await supabaseUpdate("profiles", session.access_token, `id=eq.${userId}`, { display_name: name });
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const savePetAndFinish = async () => {
    setError("");
    if (!session || !userId) {
      onDone({ name, pets: [{ name: petName, emoji: petEmoji, species: petType }] });
      return;
    }
    setLoading(true);
    try {
      const inserted = await supabaseInsert("pets", session.access_token, {
        owner_id: userId,
        name: petName,
        species: petType,
        emoji: petEmoji,
      });
      onDone({ name, pets: [{ id: inserted[0]?.id, name: petName, emoji: petEmoji, species: petType }] });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const skipPet = () => {
    onDone({ name, pets: [] });
  };

  return (
    <div style={{ padding: "32px 24px", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
        {[1, 2].map((s) => (
          <div key={s} style={{ flex: 1, height: 5, borderRadius: 3, background: s <= step ? C.mustard : C.line }} />
        ))}
      </div>

      {error && (
        <div
          style={{
            background: "#FDECEA",
            color: "#C0392B",
            padding: "10px 14px",
            borderRadius: 10,
            fontFamily: FONT_BODY,
            fontSize: 12.5,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      {step === 1 && (
        <>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: C.ink, marginBottom: 4 }}>Önce seni tanıyalım</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.inkSoft, marginBottom: 24 }}>
            Bu senin insan profilin — hayvanlarını birazdan ekleyeceksin.
          </div>
          <TextField label="Adın Soyadın" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Ayşe Yılmaz" />
          <PrimaryButton style={{ width: "100%", marginTop: 8 }} disabled={!name || loading} onClick={saveNameAndContinue}>
            {loading ? "..." : "Devam et"}
          </PrimaryButton>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: C.ink, marginBottom: 4 }}>Şimdi dostunu ekle</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.inkSoft, marginBottom: 24 }}>
            İstersen daha sonra başka hayvan da ekleyebilirsin.
          </div>
          <TextField label="Hayvanının Adı" value={petName} onChange={(e) => setPetName(e.target.value)} placeholder="Örn. Mustafa" />
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft }}>Türü</span>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {[
                { key: "cat", label: "Kedi", emoji: "🐱" },
                { key: "dog", label: "Köpek", emoji: "🐶" },
                { key: "other", label: "Diğer", emoji: "🐾" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setPetType(t.key)}
                  style={{
                    flex: 1,
                    padding: "12px 8px",
                    borderRadius: 12,
                    border: `2px solid ${petType === t.key ? C.mustard : C.line}`,
                    background: petType === t.key ? "#FDF1D8" : C.cream,
                    fontFamily: FONT_BODY,
                    fontWeight: 700,
                    fontSize: 13,
                    color: C.ink,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 22 }}>{t.emoji}</div>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <PrimaryButton style={{ width: "100%" }} disabled={!petName || loading} onClick={savePetAndFinish}>
            {loading ? "..." : "Profili tamamla"}
          </PrimaryButton>
          <div
            onClick={loading ? undefined : skipPet}
            style={{
              textAlign: "center",
              marginTop: 16,
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 700,
              color: C.inkSoft,
              cursor: loading ? "default" : "pointer",
            }}
          >
            Şimdilik geç, hayvanımı sonra eklerim
          </div>
        </>
      )}
    </div>
  );
}
