import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { PlatformPage } from "./pages/PlatformPage";
import { RegionsPage } from "./pages/RegionsPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { TrustPage } from "./pages/TrustPage";
import { PersonalEstimatorPage } from "./pages/PersonalEstimatorPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/platform" element={<PlatformPage />} />
          <Route path="/analyze" element={<Navigate to="/platform" replace />} />
          <Route path="/case-study" element={<Navigate to="/" replace />} />
          <Route path="/verification" element={<Navigate to="/trust" replace />} />
          <Route path="/regions" element={<RegionsPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/trust" element={<TrustPage />} />
          <Route path="/personal-estimator" element={<PersonalEstimatorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
