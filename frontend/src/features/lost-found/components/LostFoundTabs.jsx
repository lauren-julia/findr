import { NavLink } from "react-router-dom";
import { LayoutGrid, PlusCircle, Inbox, FolderKanban } from "lucide-react";
import { useAuth } from "../../auth/context/AuthContext";

export default function LostFoundTabs() {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) return null;

  return (
    <div className="lf-tabs">
      {isLoggedIn && (
        <NavLink to="/lost-and-found" end className={({ isActive }) => isActive ? "active" : ""}>
          <LayoutGrid size={15} /> View Items
        </NavLink>
      )}

      {isLoggedIn && (
        <>
          <NavLink
            to="/lost-and-found/create"
            className={({ isActive }) => isActive ? "active" : ""}
          >
            <PlusCircle size={15} />
            Make Post
          </NavLink>

          <NavLink
            to="/lost-and-found/my-posts"
            className={({ isActive }) => isActive ? "active" : ""}
          >
            <FolderKanban size={15} />
            My Posts
          </NavLink>

          <NavLink
            to="/lost-and-found/requests"
            className={({ isActive }) => isActive ? "active" : ""}
          >
            <Inbox size={15} />
            View Claims
          </NavLink>
        </>
      )}
    </div>
  );
}
