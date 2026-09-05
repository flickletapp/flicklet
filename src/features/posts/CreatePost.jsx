import { useRef, useState } from "react";
import { Camera, Trophy } from "lucide-react";
import { C, FONT_DISPLAY, FONT_BODY } from "../../theme";
import { TopBar, PrimaryButton, ErrorBanner } from "../../components/ui";
import { CATEGORIES } from "../../mockData";
import {
  supabaseUploadImage,
  supabaseDeleteImage,
  supabaseInsert,
  supabaseSelect,
  supabaseDelete,
  makeImagePath,
  isAlreadyExistsError,
} from "../../lib/supabase/client";
import { looksLikePriorAttemptMayHaveSucceeded, reconcilePostInsert, ensurePostPetsLinked } from "../../lib/supabase/reconcile";

export function CreatePostScreen({ myPets, session, userId, onPublish, onCancel }) {
  const [selectedPetIds, setSelectedPetIds] = useState(myPets[0]?.id ? [myPets[0].id] : []);
  const [caption, setCaption] = useState("");
  const [contestOn, setContestOn] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  // Ayni gonderi girisiminin (belirsiz sonuc sonrasi) tekrar denemeleri
  // AYNI kimlikle yurusun diye - path bu kimlikten turetiliyor, boylece
  // "kayit gercekten olustu mu" TAM path eslesmesiyle guvenle
  // dogrulanabiliyor (zaman sezgisi degil).
  const attemptIdRef = useRef(null);
  const getAttemptId = () => {
    if (!attemptIdRef.current) attemptIdRef.current = crypto.randomUUID();
    return attemptIdRef.current;
  };
  // Onceki deneme BELIRSIZ sonucla bittiyse (ag hatasi/sunucu yaniti
  // kayboldu) - cozulmeden YENI bir dosya secip FARKLI bir attemptId ile
  // AYNI paylasimi tekrar olusturmak ENGELLENIR. Kullanici once "tekrar
  // dene"ye basmali (ayni attemptId ile uzlasma denenir).
  const [pendingAmbiguous, setPendingAmbiguous] = useState(false);

  const togglePet = (petId) => {
    setSelectedPetIds((cur) => (cur.includes(petId) ? cur.filter((id) => id !== petId) : [...cur, petId]));
  };

  // Secim sirasi korunuyor: myPets uzerinden filtrelemek yerine
  // selectedPetIds'in kendi sirasini kullaniyoruz.
  const selectedPets = selectedPetIds
    .map((id) => myPets.find((p) => p.id === id))
    .filter(Boolean);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (pendingAmbiguous) {
      // Onceki paylasimin durumu HENUZ belirsiz - once o cozulmeden
      // farkli bir dosyayla YENI bir gonderi baslatilmasina izin verme
      // (aksi halde ayni icerik iki kez paylasilmis olabilir).
      setError('Önceki paylaşımın durumu henüz belirsiz. Lütfen önce "Tekrar dene" ile onu tamamla, sonra yeni bir fotoğraf seç.');
      e.target.value = "";
      return;
    }
    // Farkli bir dosya = YENI bir deneme - eski deneme kimligi/path'ine
    // baglanmamali.
    attemptIdRef.current = null;
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
      // attemptId sadece gorsel path'ini DEGIL, gonderi satirinin KENDI
      // ID'sini de belirler - boylece dogrulama gorseli olmayan
      // gonderilerde de calisir ve "ayni path -> ayni gonderi" varsayimina
      // (ki tek basina mukerrer gonderiyi ONLEMEZ) dayanmaz.
      const postId = getAttemptId();
      let imageUrl = null;
      let uploadedPath = null;
      if (file) {
        uploadedPath = makeImagePath({ kind: "post", userId, attemptId: postId, file });
        try {
          await supabaseUploadImage(uploadedPath, file, session.access_token);
        } catch (uploadErr) {
          // Ayni path'e (tekrar deneme) ikinci yukleme "already exists"
          // donerse bu GERCEK bir hata degil - ilk denemenin aslinda
          // basarili oldugunun isareti. Baska her hata OLDUGU GIBI firlatilir.
          if (!isAlreadyExistsError(uploadErr.rawMessage)) throw uploadErr;
        }
        imageUrl = uploadedPath;
      }

      let inserted;
      try {
        inserted = await supabaseInsert("posts", session.access_token, {
          id: postId,
          author_id: userId,
          // Gecici geriye donuk uyumluluk: posts.pet_id'ye SADECE ilk
          // secilen pet yaziliyor, tam liste post_pets'e gidiyor.
          pet_id: selectedPets[0]?.id || null,
          caption,
          image_url: imageUrl,
          contest_category: contestOn ? category : null,
        });
      } catch (insertErr) {
        // Ilk INSERT sunucuda GERCEKTEN basarili olup yanit kaybolduysa,
        // AYNI postId ile tekrar deneme unique_violation (409/23505)
        // dondurur - bu 4xx SEKLINDE bir hata ama KESIN basarisizlik
        // KANITI DEGIL. "4xx = kesin basarisiz, dosyayi sil" kuralini
        // buna KORLEMESINE uygulamiyoruz - once mevcut kaydi sahiplik ve
        // beklenen gorsel alaniyla dogruluyoruz (reconcilePostInsert -
        // uygulamanin GERCEKTEN kullandigi fonksiyon, ayrica test edildi).
        if (!looksLikePriorAttemptMayHaveSucceeded(insertErr)) {
          // KESIN reddedildi (id catismasi DEGIL, baska bir 4xx - ör.
          // dogrulama/RLS hatasi) - sunucu istegi TAM degerlendirip
          // HICBIR SEY COMMIT ETMEDEN reddetti. Bu satirin var
          // OLMADIGINDAN eminiz, gorsel varsa guvenle silinir.
          if (uploadedPath) {
            try {
              await supabaseDeleteImage(uploadedPath, session.access_token);
            } catch (cleanupErr) {
              // Silme de basarisiz olursa sessizce yut - asil hata gosteriliyor.
            }
          }
          throw insertErr;
        }

        const recon = await reconcilePostInsert({
          postId,
          userId,
          uploadedPath,
          accessToken: session.access_token,
          selectFn: supabaseSelect,
        });

        if (recon.status === "recovered") {
          // Ilk deneme GERCEKTEN basarili olmus (sahiplik + beklenen
          // gorsel alani dogrulandi) - ayni kayitla devam, dosyaya
          // dokunulmadi.
          setPendingAmbiguous(false);
          inserted = [recon.row];
        } else if (recon.status === "conflict") {
          // Kayit bulundu ama sahiplik/gorsel BEKLENENLE eslesmiyor -
          // gercek bir celiski, yine de dosyaya DOKUNULMUYOR (guvenli
          // taraf). Kullanici farkli bir fotografla YENIDEN denemeli.
          setPendingAmbiguous(false);
          setError("Beklenmeyen bir çakışma oluştu. Lütfen fotoğrafı yeniden seçip tekrar dene.");
          setPublishing(false);
          return;
        } else {
          // "ambiguous": dogrulama sorgusu basarisiz oldu VEYA satir
          // henuz gorunmuyor - KESIN basarisizlik KANITI DEGIL (ilk
          // islem henuz sunucuda tamamlanmamis/gorunur olmamis
          // OLABILIR). Dosyaya DOKUNULMUYOR, basari da GOSTERILMIYOR -
          // ayni postId/attemptId ile tekrar denemeye izin veriliyor VE
          // cozulmeden farkli bir dosyayla yeni paylasim baslatilmasi
          // handleFileChange'de engelleniyor.
          setPendingAmbiguous(true);
          setError(
            "Gönderinin durumu doğrulanamadı (bağlantı sorunu). Lütfen birazdan tekrar dene — aynı gönderi ikinci kez oluşturulmayacak."
          );
          setPublishing(false);
          return;
        }
      }
      const newPost = inserted[0];
      // Bu noktaya ulasildiysa (dogrudan basari veya "recovered") sonuc
      // artik KESIN - bekleyen belirsizlik varsa temizlenir.
      setPendingAmbiguous(false);

      // Asama 2 gecici dual-write: posts.pet_id hala tek dogru kaynak
      // (ilk pet), ayrica SECILEN TUM petler post_pets'e yaziliyor
      // (cok-pet göcü icin altyapi). Herhangi bir post_pets yazimi
      // basarisiz olursa yarim (eksik pet baglantili) bir post feed'de
      // sessizce kalmasin diye post geri siliniyor ve kullaniciya acik
      // hata gosteriliyor - tekrar denemesi gerekiyor. Gonderi satirinin
      // VAR OLMASI TEK BASINA tum islemin tamamlandigini KANITLAMAZ - bu
      // adim da (secili pet varsa) tamamlanmadan onPublish cagrilmiyor.
      if (selectedPets.length > 0) {
        try {
          await ensurePostPetsLinked({
            postId: newPost.id,
            petIds: selectedPets.map((p) => p.id),
            accessToken: session.access_token,
            insertFn: supabaseInsert,
            selectFn: supabaseSelect,
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

      attemptIdRef.current = null; // basari - sonraki paylasim YENI kimlik alsin
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
      <div className="fl-col" style={{ padding: "16px 18px 90px" }}>
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
          <span style={{ fontFamily: FONT_BODY, fontSize: 13, fontWeight: 700, color: C.inkSoft }}>Hangi dostların? (birden fazla seçebilirsin, isteğe bağlı)</span>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {myPets.map((p) => (
              <button
                key={p.id || p.name}
                onClick={() => togglePet(p.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 12,
                  border: `2px solid ${selectedPetIds.includes(p.id) ? C.mustard : C.line}`,
                  background: selectedPetIds.includes(p.id) ? "#FDF1D8" : C.cream,
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
