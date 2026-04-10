import { createRootRoute, createRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { CustomerDetailPage } from "@/pages/CustomerDetailPage";
import { DocumentListPage } from "@/pages/DocumentListPage";
import { DocumentDetailPage } from "@/pages/DocumentDetailPage";
import { DocumentEditorPage } from "@/pages/DocumentEditorPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { OpenItemsPage } from "@/pages/OpenItemsPage";
import { SettingsPage } from "@/pages/SettingsPage";

const rootRoute = createRootRoute();

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: AppShell,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: DashboardPage,
});

const customersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/customers",
  component: CustomersPage,
});

const customerDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/customers/$id",
  component: CustomerDetailPage,
});

const documentsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/documents",
  component: DocumentListPage,
});

const documentDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/documents/$id",
  component: DocumentDetailPage,
});

const documentEditorRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/documents/$id/edit",
  component: DocumentEditorPage,
});

const productsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/products",
  component: ProductsPage,
});

const openItemsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/open-items",
  component: OpenItemsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: SettingsPage,
});

export const routeTree = rootRoute.addChildren([
  loginRoute,
  appRoute.addChildren([
    dashboardRoute,
    customersRoute,
    customerDetailRoute,
    documentsRoute,
    documentDetailRoute,
    documentEditorRoute,
    productsRoute,
    openItemsRoute,
    settingsRoute,
  ]),
]);
