import { createBrowserRouter } from "react-router";
import { AuthLayout } from "./components/auth-layout";
import { Layout } from "./components/layout";
import { RequireAdmin, RequireAuth } from "./lib/session";
import { AccountPage } from "./pages/account";
import { AddressesPage } from "./pages/addresses";
import { AiMonitorPage } from "./pages/ai-monitor";
import { AuditPage } from "./pages/audit";
import { BookPage } from "./pages/book";
import { ForgotPasswordPage } from "./pages/forgot-password";
import { GroupPage } from "./pages/group";
import { HomePage } from "./pages/home";
import { InstancePage } from "./pages/instance";
import { LandingPage } from "./pages/landing";
import { LegalPage } from "./pages/legal";
import { LoginPage } from "./pages/login";
import { NotFoundPage } from "./pages/not-found";
import { PrintPage } from "./pages/print";
import { ResetPasswordPage } from "./pages/reset-password";
import { SignupPage } from "./pages/signup";
import { UserPage } from "./pages/user";
import { UsersPage } from "./pages/users";
import { VerifyPage } from "./pages/verify";

export const router = createBrowserRouter([
  // The front page is public; logged-in users are sent on to their books.
  { path: "/", element: <LandingPage /> },
  {
    element: <AuthLayout />,
    children: [
      { path: "login", element: <LoginPage /> },
      { path: "forgot-password", element: <ForgotPasswordPage /> },
      { path: "reset-password", element: <ResetPasswordPage /> },
      { path: "signup", element: <SignupPage /> },
      { path: "verify", element: <VerifyPage /> },
      { path: "imprint", element: <LegalPage page="imprint" /> },
      { path: "privacy", element: <LegalPage page="privacy" /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      // Without the app layout, so only the sheet is printed.
      { path: "groups/:id/print", element: <PrintPage /> },
      // Uses the whole window; loaded on demand (CodeMirror is large).
      { path: "books/:id/edit", lazy: () => import("./pages/editor") },
      {
        element: <Layout />,
        children: [
          { path: "books", element: <HomePage /> },
          { path: "books/:id", element: <BookPage /> },
          { path: "groups/:id", element: <GroupPage /> },
          { path: "account", element: <AccountPage /> },
          {
            element: <RequireAdmin />,
            children: [
              { path: "users", element: <UsersPage /> },
              { path: "users/:id", element: <UserPage /> },
              { path: "addresses", element: <AddressesPage /> },
              { path: "instance", element: <InstancePage /> },
              { path: "ai-monitor", element: <AiMonitorPage /> },
              { path: "audit", element: <AuditPage /> },
            ],
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
