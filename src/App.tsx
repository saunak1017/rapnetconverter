import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { UploadPage } from "./pages/UploadPage";
import { ConfigurePage } from "./pages/ConfigurePage";
import { EditPage } from "./pages/EditPage";
import { PublicPage } from "./pages/PublicPage";
import { PasswordGate } from "./components/PasswordGate";
import "./styles.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PasswordGate><UploadPage /></PasswordGate>} />
        <Route path="/configure" element={<PasswordGate><ConfigurePage /></PasswordGate>} />
        <Route path="/edit" element={<PasswordGate><EditPage /></PasswordGate>} />
        <Route path="/r/:slug" element={<PublicPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
