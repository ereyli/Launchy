import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { Home } from "./pages/Home";
import { TokenLaunchpad } from "./pages/TokenLaunchpad";
import { NFTLaunchpad } from "./pages/NFTLaunchpad";
import { CreateProject } from "./pages/CreateProject";
import { TokenDetail } from "./pages/TokenDetail";
import { CollectionDetail } from "./pages/CollectionDetail";
import { Profile } from "./pages/Profile";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Navigation />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/token-launchpad" element={<TokenLaunchpad />} />
          <Route path="/nft-launchpad" element={<NFTLaunchpad />} />
          <Route path="/create" element={<CreateProject />} />
          <Route path="/token/:id" element={<TokenDetail />} />
          <Route path="/collection/:id" element={<CollectionDetail />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
        <MobileBottomNav />
        <Toaster />
      </div>
    </BrowserRouter>
  );
}
