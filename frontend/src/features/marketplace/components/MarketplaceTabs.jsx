import { NavLink } from "react-router-dom";
import { LayoutGrid, PlusCircle, Inbox, FolderKanban } from "lucide-react";
import { useAuth } from "../../auth/context/AuthContext";

export default function MarketplaceTabs() {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) return null;

  return (
    <div className="marketplace-switch">
      <NavLink to="/marketplace" end className={({ isActive }) => isActive ? "selected" : ""}>
        <LayoutGrid size={15} /> View Listings
      </NavLink>

      <NavLink
        to="/marketplace/create"
        className={({ isActive }) => isActive ? "selected" : ""}
      >
        <PlusCircle size={15} />
        Create Listing
      </NavLink>

      <NavLink
        to="/marketplace/my-listings"
        className={({ isActive }) => isActive ? "selected" : ""}
      >
        <FolderKanban size={15} />
        My Listings
      </NavLink>

      <NavLink
        to="/marketplace/requests"
        className={({ isActive }) => isActive ? "selected" : ""}
      >
        <Inbox size={15} />
        View Requests
      </NavLink>
    </div>
  );
}
