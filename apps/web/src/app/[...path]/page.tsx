import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicContentPage } from "../content-page-data";
import { PageMarkdown } from "../page-markdown";

type ContentPageRouteProps = {
  params: Promise<{
    path: string[];
  }>;
};

export const dynamic = "force-dynamic";

const getPathFromParams = (pathSegments: readonly string[]): string =>
  `/${pathSegments.join("/")}`;

export const generateMetadata = async ({ params }: ContentPageRouteProps): Promise<Metadata> => {
  const { path } = await params;
  const result = await getPublicContentPage(getPathFromParams(path));

  if (result.status !== "loaded") {
    return {};
  }

  return {
    title: `${result.page.seoTitle ?? result.page.title} | Maiks.yt`,
    description: result.page.seoDescription ?? undefined
  };
};

const RuntimeContentPage = async ({ params }: ContentPageRouteProps): Promise<React.ReactNode> => {
  const { path } = await params;
  const result = await getPublicContentPage(getPathFromParams(path));

  if (result.status === "not-found") {
    notFound();
  }

  if (result.status === "error") {
    return (
      <main className="content-page">
        <section className="project-state-card failed" aria-live="polite">
          <h1>Page temporarily unavailable</h1>
          <p>The public page API did not respond. Try again after the dev services settle.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="content-page">
      <article className="content-page-article">
        <header className="content-page-header">
          <p className="eyebrow">Maiks.yt</p>
          <h1>{result.page.title}</h1>
          {result.page.seoDescription ? <p>{result.page.seoDescription}</p> : null}
        </header>
        <PageMarkdown body={result.page.body} />
      </article>
    </main>
  );
};

export default RuntimeContentPage;
