import { Component } from "react";
import { C, FONT_DISPLAY, FONT_BODY } from "../theme";

// Beklenmeyen bir render hatasında beyaz ekran yerine kullanıcıya
// anlaşılır bir mesaj gösterir. Roadmap Aşama 1 gereksinimi.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Flicklet render hatası:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
            background: C.paper,
            color: C.ink,
          }}
        >
          <div style={{ fontSize: 40 }}>🐾</div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 18 }}>Bir şeyler ters gitti</div>
          <div style={{ fontFamily: FONT_BODY, fontSize: 13.5, color: C.inkSoft, maxWidth: 320 }}>
            Sayfayı yenilemeyi dene. Sorun devam ederse bize bildir.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              background: C.mustard,
              color: C.cream,
              border: "none",
              borderRadius: 12,
              padding: "10px 20px",
              fontFamily: FONT_DISPLAY,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Sayfayı yenile
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
