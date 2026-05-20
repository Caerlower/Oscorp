import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WalletProviders } from "@/components/WalletProviders";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-aurora px-4">
      <div className="glass-strong max-w-md rounded-3xl p-10 text-center shadow-float">
        <h1 className="text-7xl font-semibold tracking-tight">404</h1>
        <p className="mt-3 text-muted-foreground">This page drifted into the aether.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
        >
          Take me home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-aurora px-4">
      <div className="glass-strong max-w-md rounded-3xl p-10 text-center shadow-float">
        <h1 className="text-xl font-semibold">Something hiccupped</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Oscorp — Your AI growth operator for X" },
      {
        name: "description",
        content:
          "Oscorp researches trends, drafts viral content, and pays for GTM via x402 on Algorand.",
      },
      { property: "og:title", content: "Oscorp — Your AI growth operator for X" },
      {
        property: "og:description",
        content:
          "Oscorp researches trends, drafts viral content, and pays for GTM via x402 on Algorand.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "icon", href: "/oscorp-mark.svg", type: "image/svg+xml" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProviders>
        <Outlet />
        <Toaster position="top-center" richColors />
      </WalletProviders>
    </QueryClientProvider>
  );
}
