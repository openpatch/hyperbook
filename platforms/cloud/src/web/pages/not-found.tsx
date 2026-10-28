import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <>
      <h1 className="mb-4 text-3xl">Page not found</h1>
      <Link to="/" className="text-primary underline">
        Back to your books
      </Link>
    </>
  );
}
