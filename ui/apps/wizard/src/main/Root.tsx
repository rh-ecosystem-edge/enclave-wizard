import "@patternfly/react-core/dist/styles/base.css";

import {
  ConfigApi,
  Configuration,
  DefaultsApi,
  PluginsApi,
  TasksApi,
} from "@enclave-wizard-ui/api-client";
import { Spinner } from "@patternfly/react-core";
import {
  Container,
  Provider as DependencyInjectionProvider,
} from "@y0n1/react-ioc";
import React, { useCallback, useMemo } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AuthProvider, useAuth } from "../auth/AuthContext.tsx";
import { router } from "./Router.tsx";
import { Symbols } from "./Symbols.ts";

function getApiBasePath(): string {
  return window.location.origin;
}

function AuthenticatedApp(): React.ReactElement {
  const { token, logout } = useAuth();

  const handleUnauthorized = useCallback(() => {
    logout();
  }, [logout]);

  const container = useMemo(() => {
    const apiConfig = new Configuration({
      basePath: getApiBasePath(),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      middleware: [
        {
          post: async (context) => {
            if (context.response.status === 401) {
              handleUnauthorized();
            }
            return context.response;
          },
        },
      ],
      fetchApi: (url, init) => fetch(url, { ...init, cache: "no-store" }),
    });

    return new Container()
      .register(Symbols.ConfigApi, new ConfigApi(apiConfig))
      .register(Symbols.DefaultsApi, new DefaultsApi(apiConfig))
      .register(Symbols.PluginsApi, new PluginsApi(apiConfig))
      .register(Symbols.TasksApi, new TasksApi(apiConfig));
  }, [token, handleUnauthorized]);

  return (
    <DependencyInjectionProvider container={container}>
      <React.Suspense fallback={<Spinner />}>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </React.Suspense>
    </DependencyInjectionProvider>
  );
}

function main(): void {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("Root element not found.");
  }

  root.style.height = "inherit";
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </React.StrictMode>,
  );
}

main();
