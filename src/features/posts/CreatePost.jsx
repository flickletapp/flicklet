import { useRef, useState } from "react";
import { Camera, Trophy } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../../theme";
import { TopBar, PrimaryButton, ErrorBanner } from "../../components/ui";
import { CATEGORIES } from "../../mockData";
import { supabaseUploadImage, supabaseInsert, supabaseDelete } from "../../lib/supabase/client";

export function CreatePostScreen({ myPets, session, userId, onPublish, onCancel }) {
  const [selectedPetId, setSelectedPetId] = useState(myPets[0]?.id || "");
  const [caption, setCaption] = useState("");
  const [contestOn, setContestOn] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const selectedPet = myPets.find((p) => p.id === selectedPetId);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const fileToDataUrl = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const publish = async () => {
    if (!caption) return;
    setError("");
    setPublishing(true);
    try {
      let moderationRes = { flagged: false };
      try {
        const res = await fetch("/api/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: caption,
            imageUrl: file ? await fileToDataUrl(file) : null,
          }),
        });
        if (res.ok) moderationRes = await res.json();
      } catch (e) {
        // moderasyon servisine ulaşılamadı (ör. yerel geliştirme ortamı) — paylaşımı engelleme
      }
      if (moderationRes.flagged) {
        setError("Bu içerik topluluk kurallarına aykırı görünüyor, paylaşılamadı.");
        setPublishing(false);
        return;
      }
      let imageUrl = null;
      if (file) {
        const path = `${userId}/${Date.now()}-${file.name}`;
        imageUrl = await supabaseUploadImage(path, file, session.access_token);
      }
      const inserted = await supabaseInsert("posts", session.access_token, {
        author_id: userId,
        pet_id: selectedPet?.id || null,
        caption,
        image_url: imageUrl,
        contest_category: contestOn ? category : null,
      });
      const newPost = inserted[0];

      // Asama 2 gecici dual-write: posts.pet_id hala tek dogru kaynak,
      // ayrica post_pets'e de yaziliyor (cok-pet göcü icin altyapi).
      // Bu adim basarisiz olursa yarim (pet baglantisiz) bir post feed'de
      // sessizce kalmasin diye post geri siliniyor ve kullaniciya acik
      // hata gosteriliyor - tekrar denemesi gerekiyor.
      if (selectedPet?.id) {
        try {
          await supabaseInsert("post_pets", session.access_token, {
            post_id: newPost.id,
            pet_id: selectedPet.id,
          });
        } catch (ppError) {
          try {
            await supabaseDelete("posts", session.access_token, `id=eq.${newPost.id}`);
          } catch (deleteError) {
            throw new Error("Gönderi oluşturuldu fakat geri alınamadı, lütfen bize bildir: " + deleteError.message);
          }
          throw new Error("Gönderi pet bağlantısıyla kaydedilemedi, tekrar dene: " + ppError.message);
        }
      }

      onPublish(newPost);
    } catch (e) {
      setError(e.message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div>
      <TopBar title="Yeni Gönderi" onBack={onCancel} />
      <div style={{ padding: "16px 18px 90px", maxWidth: 480, margin: "0 auto" }}>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            minHeight: previewUrl ? 0 : 220,
            maxHeight: 420,
            borderRadius: 18,
            background: previewUrl ? C.paper : `linear-gradient(135deg, ${C.mustard}33, ${C.mustard}11)`,
            border: `2px dashed ${C.mustard}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 18,
            cursor: "pointer",
            overflow: "hidden",
          }}
        >
          {previewUrl && (
            <img src={previewUrl} alt="Önizleme" style={{ width: "100%", maxHeight: 420, objectFit: "contain", display: "block" }} />
          )}
          {!previewUrl && (
            <>
              <Camera size={30} color={C.mustard} />
              <div style={{ fontFamily: FONT_BODY, fontSize: 12.5, color: C.inkSoft }}>Fotoğraf eklemek için dokun (isteğe bağlı)</div>
            </>
          )}
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft }}>Hangi dostun?</span>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {myPets.map((p) => (
              <button
                key={p.id || p.name}
                onClick={() => setSelectedPetId((cur) => (cur === p.id ? "" : p.id))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: `2px solid ${selectedPetId === p.id ? C.mustard : C.line}`,
                  background: selectedPetId === p.id ? "#FDF1D8" : C.cream,
                  fontFamily: FONT_BODY,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <span>{p.emoji}</span> {p.name}
              </button>
            ))}
          </div>
        </div>

        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft }}>Açıklama</span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Flick at, nasıl olduğunu paylaş 🐾"
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
        </label>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: C.cream,
            border: `1px solid ${C.line}`,
            borderRadius: 14,
            padding: "13px 16px",
            marginBottom: contestOn ? 10 : 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Trophy size={18} color={C.mustard} />
            <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13.5, color: C.ink }}>Yarışmaya gir</div>
          </div>
          <button
            onClick={() => setContestOn((v) => !v)}
            style={{
              width: 44,
              height: 26,
              borderRadius: 13,
              border: "none",
              background: contestOn ? C.mustard : C.line,
              position: "relative",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: C.cream,
                position: "absolute",
                top: 3,
                left: contestOn ? 21 : 3,
                transition: "left 0.15s ease",
              }}
            />
          </button>
        </div>

        {contestOn && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  style={{
                    whiteSpace: "nowrap",
                    padding: "8px 13px",
                    borderRadius: 11,
                    border: `2px solid ${category === c ? C.mustard : C.line}`,
                    background: category === c ? "#FDF1D8" : C.cream,
                    fontFamily: FONT_BODY,
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: C.inkSoft, marginTop: 8, lineHeight: 1.5 }}>
              Bu gönderi yarışma süresince, profil ayarından bağımsız olarak herkese açık olacak.
            </div>
          </div>
        )}

        <PrimaryButton style={{ width: "100%" }} disabled={!caption || publishing} onClick={publish}>
          {publishing ? "Paylaşılıyor..." : "Paylaş"}
        </PrimaryButton>
      </div>
    </div>
  );
}
