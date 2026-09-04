import { useState } from "react";
import { C, FONT_DISPLAY, FONT_BODY } from "../../theme";
import { TextField, UsernameField, PrimaryButton, ErrorBanner } from "../../components/ui";
import {
  supabaseSignUp,
  supabaseSignInWithIdentifier,
  validateUsername,
  checkUsernameAvailable,
  LOGIN_GENERIC_ERROR,
  LOGIN_RATE_LIMITED,
  LOGIN_USERNAME_UNAVAILABLE,
} from "../../lib/supabase/client";

export function AuthScreen({ onDone, onGuest }) {
  const [mode, setMode] = useState("login"); // login | signup | verify
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState(""); // yalnizca signup modunda
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async () => {
    if (loading) return;
    setError("");
    if (!identifier || !pw) return setError("E-posta ve şifre gerekli.");
    if (pw.length < 8) return setError("Şifre en az 8 karakter olmalı.");
    const usernameCheck = validateUsername(username);
    if (!usernameCheck.valid) return setError(usernameCheck.error);
    setLoading(true);
    try {
      // Hesap olusturulmadan ONCE uygunluk kontrolu. Es zamanli bir
      // cakisma (iki kisi ayni anda ayni adi secerse) bu kontrolden
      // kacabilir - o durumda son guvence olarak veritabanindaki
      // case-insensitive UNIQUE index devreye girer (bkz.
      // 013_user_chosen_handle migration) ve signup asagidaki catch'e
      // dusup ayni "kullaniliyor" mesajini gosterir.
      const available = await checkUsernameAvailable(usernameCheck.value);
      if (!available) return setError("Bu kullanıcı adı kullanılıyor.");

      const data = await supabaseSignUp(identifier, pw, { handle: usernameCheck.value });
      if (data?.identities && data.identities.length === 0) {
        setError("Bu e-posta zaten kayıtlı. Lütfen giriş yap.");
        setMode("login");
        return;
      }
      setMode("verify");
    } catch (e) {
      // Es zamanli cakisma son guvenceye (DB unique index) takilirsa
      // GoTrue signup'i genelde 500/duplicate-benzeri bir hata dondurur;
      // kullanici adiyla ilgili gorunuyorsa ayni anlasilir mesaji goster.
      if (/handle|duplicate|unique/i.test(e.message || "")) {
        setError("Bu kullanıcı adı kullanılıyor.");
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (loading) return;
    setError("");
    if (!identifier || !pw) return setError("Kullanıcı adı/e-posta ve şifre gerekli.");
    setLoading(true);
    try {
      const data = await supabaseSignInWithIdentifier(identifier, pw);
      onDone(data);
    } catch (e) {
      // Hatali bilgi durumunda TEK ve genel mesaj - hesap var/yok
      // ayrimi yapilmaz. Sadece "cok fazla deneme" ve "kullanici adiyla
      // giris su an kapali" ayri ele alinir; bunlar kimlik bilgisi
      // sizdirmayan, kullaniciya gercekten yardimci durumlar.
      if (e?.code === LOGIN_RATE_LIMITED) {
        setError("Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar dene.");
      } else if (e?.code === LOGIN_USERNAME_UNAVAILABLE) {
        setError("Kullanıcı adıyla giriş şu an kullanılamıyor. Lütfen e-posta adresinle giriş yap.");
      } else {
        setError(LOGIN_GENERIC_ERROR);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    if (mode === "signup") handleSignUp();
    else if (mode === "login") handleLogin();
  };

  return (
    <div style={{ padding: "40px 24px", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <img src="/favicon.png" alt="" style={{ width: 60, height: 60 }} />
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 34,
              fontWeight: 600,
              color: C.pine,
              letterSpacing: -0.5,
            }}
          >
            flicklet
          </div>
        </div>
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.inkSoft, marginTop: 4 }}>
          Evcil dostların sosyal evi
        </div>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {(mode === "signup" || mode === "login") && (
        <>
          <div
            style={{
              textAlign: "center",
              marginBottom: 18,
              fontFamily: FONT_BODY,
              fontSize: 12.5,
              color: C.inkSoft,
              background: C.cream,
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              padding: "8px 10px",
            }}
          >
            🔒 Google ile giriş, uygulama yayına alındığında (gerçek domain bağlanınca) aktif olacak — şimdilik e-posta ile devam edin.
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "login" ? (
              <TextField
                label="Kullanıcı adı veya e-posta"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="kullaniciadi veya ornek@eposta.com"
              />
            ) : (
              <>
                <TextField label="E-posta" type="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="ornek@eposta.com" />
                <UsernameField
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="kullaniciadi"
                  hint="Yalnızca harf, rakam ve alt çizgi (_) kullanılabilir, 3-20 karakter. Örn: ayse_yilmaz93. Başına @ yazmana gerek yok, otomatik eklenir."
                />
              </>
            )}
            <TextField label="Şifre" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="En az 8 karakter" />
            <PrimaryButton type="submit" style={{ width: "100%", marginTop: 8 }} disabled={loading}>
              {loading ? "..." : mode === "signup" ? "Hesap Oluştur" : "Giriş Yap"}
            </PrimaryButton>
          </form>
          <div style={{ textAlign: "center", marginTop: 16, fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>
            {mode === "login" ? (
              <>
                Hesabın yok mu?{" "}
                <span onClick={() => setMode("signup")} style={{ color: C.pine, fontWeight: 700, cursor: "pointer" }}>
                  Hesap oluştur
                </span>
              </>
            ) : (
              <>
                Zaten hesabın var mı?{" "}
                <span onClick={() => setMode("login")} style={{ color: C.pine, fontWeight: 700, cursor: "pointer" }}>
                  Giriş yap
                </span>
              </>
            )}
          </div>
          <div
            onClick={onGuest}
            style={{
              textAlign: "center",
              marginTop: 20,
              paddingTop: 18,
              borderTop: `1px solid ${C.line}`,
              fontFamily: FONT_BODY,
              fontSize: 13,
              fontWeight: 700,
              color: C.mustardDark,
              cursor: "pointer",
            }}
          >
            Üye olmadan gözat →
          </div>
        </>
      )}

      {mode === "verify" && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📩</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, color: C.ink, marginBottom: 6 }}>E-postanı kontrol et</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.inkSoft, marginBottom: 24, lineHeight: 1.5 }}>
            <strong>{identifier}</strong> adresine gerçek bir doğrulama bağlantısı gönderdik. Gelen kutunu (ve spam klasörünü) kontrol edip bağlantıya tıkla, sonra buraya dönüp giriş yap.
          </div>
          <PrimaryButton style={{ width: "100%" }} onClick={() => setMode("login")}>
            Doğruladım, giriş yap
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
