import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { UploadPage } from "./pages/UploadPage";
import { ConfigurePage } from "./pages/ConfigurePage";
import { EditPage } from "./pages/EditPage";
import { PublicPage } from "./pages/PublicPage";
import "./styles.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UploadPage />} />
        <Route path="/configure" element={<ConfigurePage />} />
        <Route path="/edit" element={<EditPage />} />
        <Route path="/r/:slug" element={<PublicPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
