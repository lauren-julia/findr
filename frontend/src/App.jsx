import "./shared/styles/listing-details.css";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./features/auth/context/AuthContext";
import ProtectedRoute from "./shared/components/ProtectedRoute";
import PublicLayout from "./shared/layouts/PublicLayout";
import Home from "./features/home/pages/Home";
import Marketplace from "./features/marketplace/pages/Marketplace";
import LostFoundDetail from "./features/lost-found/pages/LostFoundDetail";
import CreateListing from "./features/marketplace/pages/CreateListing";
import MarketplaceRequests from "./features/marketplace/pages/MarketplaceRequests";
import MyListings from "./features/marketplace/pages/MyListings";
import LostAndFound from "./features/lost-found/pages/LostAndFound";
import CreateLostFound from "./features/lost-found/pages/CreateLostFound";
import LostFoundMyPosts from "./features/lost-found/pages/LostFoundMyPosts";
import LostFoundRequests from "./features/lost-found/pages/LostFoundRequests";
import Tambayan from "./features/tambayan/pages/Tambayan";
import Login from "./features/auth/pages/Login";
import Signup from "./features/auth/pages/Signup";
import ForgotPassword from "./features/auth/pages/ForgotPassword";
import ResetPassword from "./features/auth/pages/ResetPassword";
import AdminRoute from "./features/admin/components/AdminRoute";
import AdminDashboard from "./features/admin/pages/AdminDashboard";
import AdminUsers from "./features/admin/pages/AdminUsers";
import AdminListings from "./features/admin/pages/AdminListings";
import AdminSystemManagement from "./features/admin/pages/AdminSystemManagement";

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />

            <Route path="/marketplace" element={<Marketplace />} />

            <Route
              path="/marketplace/create"
              element={
                <ProtectedRoute>
                  <CreateListing />
                </ProtectedRoute>
              }
            />

            <Route
              path="/marketplace/my-listings"
              element={
                <ProtectedRoute>
                  <MyListings />
                </ProtectedRoute>
              }
            />

            <Route
              path="/marketplace/requests"
              element={
                <ProtectedRoute>
                  <MarketplaceRequests />
                </ProtectedRoute>
              }
            />

            <Route path="/lost-and-found" element={<LostAndFound />} />
            <Route path="/lost-and-found/:id" element={<LostFoundDetail />} />

            <Route
              path="/lost-and-found/create"
              element={
                <ProtectedRoute>
                  <CreateLostFound />
                </ProtectedRoute>
              }
            />

            <Route
              path="/lost-and-found/my-posts"
              element={
                <ProtectedRoute>
                  <LostFoundMyPosts />
                </ProtectedRoute>
              }
            />

            <Route
              path="/lost-and-found/requests"
              element={
                <ProtectedRoute>
                  <LostFoundRequests />
                </ProtectedRoute>
              }
            />

            <Route path="/tambayan" element={<Tambayan />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <PublicLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="listings" element={<AdminListings />} />
            <Route path="system" element={<AdminSystemManagement />} />
          </Route>
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
