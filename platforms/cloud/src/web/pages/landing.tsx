import { ArrowUpRight, Cloud, Container, LogIn, Rocket } from "lucide-react";
import { Link, Navigate } from "react-router";
import { LegalLinks } from "@/components/auth-layout";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useInstance, useMe } from "@/lib/session";

const DOCS = "https://hyperbook.openpatch.org";
const HOSTED = "https://hyperbook.cloud";
const SELF_HOST =
  "https://github.com/openpatch/hyperbook/tree/main/platforms/cloud";
const HOSTING_DOCS = `${DOCS}/hosting/`;

/**
 * The front page of an instance, shown to visitors who are not logged in.
 * Introduces Hyperbook and links the three ways to run it; the admin frontend
 * is one click away behind "Log in". Logged-in users go straight to their
 * books.
 */
export function LandingPage() {
  const { data: me } = useMe();
  const { data: instance, isPending } = useInstance();

  if (me) return <Navigate to="/books" replace />;
  // Wait for the instance settings, so a disabled landing page does not flash.
  if (isPending) return null;
  // The admin may switch the landing page off; then only the login shows.
  if (instance && instance.landingPage === false)
    return <Navigate to="/login" replace />;
  // Sign-up is offered only in the mode the admin configured.
  const canSignup = !!instance && instance.signupMode !== "closed";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-15 shrink-0 items-center gap-2 bg-header pr-4 text-header-foreground shadow-md">
        <span className="min-w-0 flex-1 truncate p-4 font-heading text-[1.1rem] font-bold">
          {instance?.name ?? "Hyperbook Cloud"}
        </span>
        <ThemeToggle className="hover:bg-white/15" />
        {instance && instance.signupMode !== "closed" && (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-header-foreground hover:bg-white/15 hover:text-header-foreground"
          >
            <Link to="/signup">Sign up</Link>
          </Button>
        )}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-header-foreground hover:bg-white/15 hover:text-header-foreground"
        >
          <Link to="/login">
            <LogIn /> Log in
          </Link>
        </Button>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 py-12 md:py-20">
        <div className="w-full max-w-3xl text-center">
          <h1 className="font-heading text-4xl font-bold md:text-5xl">
            Power your Hyperbook
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Hyperbook is a quick and easy way to build interactive workbooks
            that support modern standards and run superfast. Write Markdown, get
            a static site with interactive elements — no coding experience
            needed.
          </p>
        </div>

        <section
          aria-label="Ways to run Hyperbook"
          className="mt-12 grid w-full max-w-5xl gap-4 md:grid-cols-3"
        >
          <OptionCard
            icon={<Cloud className="size-6" />}
            title="Hosted by OpenPatch"
            description={
              canSignup
                ? "No server of your own needed: on this instance — hyperbook.cloud, run by OpenPatch — you create an account and write, publish and share your books right in the browser."
                : "No server of your own needed: on hyperbook.cloud, our public instance, you get an account and write, publish and share your books right in the browser."
            }
            action={
              canSignup ? (
                <Button asChild className="w-full">
                  <Link to="/signup">Create an account</Link>
                </Button>
              ) : (
                <Button asChild className="w-full">
                  <a href={HOSTED} target="_blank" rel="noreferrer">
                    Open hyperbook.cloud <ArrowUpRight />
                  </a>
                </Button>
              )
            }
          />
          <OptionCard
            icon={<Container className="size-6" />}
            title="Self-hosted with Docker"
            description="Run your own instance in one container — SQLite plus one data volume, published per release as ghcr.io/openpatch/hyperbook-cloud."
            snippet="docker compose up -d"
            action={
              <Button asChild variant="outline" className="w-full">
                <a href={SELF_HOST} target="_blank" rel="noreferrer">
                  Self-hosting guide <ArrowUpRight />
                </a>
              </Button>
            }
          />
          <OptionCard
            icon={<Rocket className="size-6" />}
            title="Deploy anywhere with the CLI"
            description="Build a static site with the Hyperbook CLI and upload the .hyperbook/out folder to any host — GitHub Pages, Vercel, your own web server."
            snippet="npx hyperbook build"
            action={
              <Button asChild variant="outline" className="w-full">
                <a href={HOSTING_DOCS} target="_blank" rel="noreferrer">
                  Hosting docs <ArrowUpRight />
                </a>
              </Button>
            }
          />
        </section>
      </main>

      <LegalLinks />
      <footer className="flex flex-col items-center gap-1 p-4 text-center text-sm text-muted-foreground">
        <p>
          Built with ❤️ by{" "}
          <a
            href="https://openpatch.org"
            target="_blank"
            rel="noreferrer"
            className="hover:text-primary"
          >
            OpenPatch
          </a>
        </p>
        <p>
          <a
            href={DOCS}
            target="_blank"
            rel="noreferrer"
            className="hover:text-primary"
          >
            Documentation
          </a>{" "}
          •{" "}
          <a
            href="https://github.com/openpatch/hyperbook"
            target="_blank"
            rel="noreferrer"
            className="hover:text-primary"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

function OptionCard({
  icon,
  title,
  description,
  snippet,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  snippet?: string;
  action: React.ReactNode;
}) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          {icon}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {snippet && (
        <CardContent>
          <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-xs whitespace-nowrap">
            {snippet}
          </code>
        </CardContent>
      )}
      <CardFooter className="mt-auto">{action}</CardFooter>
    </Card>
  );
}
