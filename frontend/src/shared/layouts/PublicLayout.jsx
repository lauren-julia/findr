import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function PublicLayout() {
  return (
    <div className="app-container">
      <Navbar />

      <Outlet />

      <footer className="footer">
        <span>© 2026 Findr Platform. Built for the USC Community.</span>
        <span>How It Works　 Privacy Policy　 Help Support</span>
      </footer>
    </div>
  );
}
