import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <>
      <h1 className="mb-4 text-3xl">{t("notFound.title")}</h1>
      <Link to="/books" className="text-primary underline">
        {t("notFound.back")}
      </Link>
    </>
  );
}
