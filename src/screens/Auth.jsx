import { useState } from "react";
import { C, FONT_DISPLAY, FONT_BODY } from "../theme";
import { TextField, PrimaryButton } from "../components/ui";
import { supabaseSignUp, supabaseSignIn } from "../lib/supabaseClient";

export function AuthScreen({ onDone, onGuest }) {
  const [mode, setMode] = useState("signup"); // signup | verify | login
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignUp = async () => {
    setError("");
    if (!email || !pw) return setError("E-posta ve şifre gerekli.");
    if (pw.length < 8) return setError("Şifre en az 8 karakter olmalı.");
    setLoading(true);
    try {
      const data = await supabaseSignUp(email, pw);
      if (data?.identities && data.identities.length === 0) {
        setError("Bu e-posta zaten kayıtlı. Lütfen giriş yap.");
        setMode("login");
        return;
      }
      setMode("verify");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError("");
    if (!email || !pw) return setError("E-posta ve şifre gerekli.");
    setLoading(true);
    try {
      const data = await supabaseSignIn(email, pw);
      onDone(data);
    } catch (e) {
      setError("E-posta veya şifre hatalı, ya da hesap henüz doğrulanmadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px 24px", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
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
        <div style={{ fontFamily: FONT_BODY, fontSize: 14, color: C.inkSoft, marginTop: 4 }}>
          Evcil dostların sosyal evi
        </div>
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

          <TextField label="E-posta" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@eposta.com" />
          <TextField label="Şifre" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="En az 8 karakter" />
          <PrimaryButton style={{ width: "100%", marginTop: 8 }} disabled={loading} onClick={mode === "signup" ? handleSignUp : handleLogin}>
            {loading ? "..." : mode === "signup" ? "Hesap Oluştur" : "Giriş Yap"}
          </PrimaryButton>
          <div style={{ textAlign: "center", marginTop: 16, fontFamily: FONT_BODY, fontSize: 13, color: C.inkSoft }}>
            {mode === "signup" ? (
              <>
                Zaten hesabın var mı?{" "}
                <span onClick={() => setMode("login")} style={{ color: C.pine, fontWeight: 700, cursor: "pointer" }}>
                  Giriş yap
                </span>
              </>
            ) : (
              <>
                Hesabın yok mu?{" "}
                <span onClick={() => setMode("signup")} style={{ color: C.pine, fontWeight: 700, cursor: "pointer" }}>
                  Kayıt ol
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
            <strong>{email}</strong> adresine gerçek bir doğrulama bağlantısı gönderdik. Gelen kutunu (ve spam klasörünü) kontrol edip bağlantıya tıkla, sonra buraya dönüp giriş yap.
          </div>
          <PrimaryButton style={{ width: "100%" }} onClick={() => setMode("login")}>
            Doğruladım, giriş yap
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
