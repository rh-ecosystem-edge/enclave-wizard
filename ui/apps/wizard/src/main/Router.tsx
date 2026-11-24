import { createBrowserRouter, Link } from "react-router-dom";
import { ErrorPage } from "../pages/ErrorPage.tsx";
import { AuthGuard } from "./AuthGuard.tsx";
import { ConditionalRedirect } from "./ConditionalRedirect.tsx";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <AuthGuard />,
      children: [
        {
          index: true,
          element: <ConditionalRedirect />,
        },
      ],
    },
    {
      path: "/login",
      errorElement: <ErrorPage />,
      lazy: async () => {
        const { LoginPage } = await import("../auth/LoginPage.tsx");
        return { Component: LoginPage };
      },
    },
    {
      path: "/wizard",
      errorElement: <ErrorPage />,
      element: <AuthGuard />,
      children: [
        {
          index: true,
          lazy: async () => {
            const { WizardPage } = await import("../wizard/WizardPage.tsx");
            return { Component: WizardPage };
          },
        },
      ],
    },
    {
      path: "/tasks",
      errorElement: <ErrorPage />,
      element: <AuthGuard />,
      children: [
        {
          index: true,
          lazy: async () => {
            const { TasksPage } = await import("../tasks/TasksPage.tsx");
            return { Component: TasksPage };
          },
        },
      ],
    },
    {
      path: "*",
      element: (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h1>404 — Page not found</h1>
          <p>
            <Link to="/login">Go to login</Link>
          </p>
        </div>
      ),
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  },
);
