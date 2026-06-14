import Link from "next/link";
import { notFound } from "next/navigation";

import { publicUpdates } from "../../../content/public-updates";

type UpdatePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const generateStaticParams = (): Array<{ slug: string }> =>
  publicUpdates.map((update) => ({ slug: update.slug }));

const UpdatePage = async ({ params }: UpdatePageProps): Promise<React.ReactNode> => {
  const { slug } = await params;
  const update = publicUpdates.find((candidate) => candidate.slug === slug);

  if (!update) {
    notFound();
  }

  return (
    <main className="updates-page">
      <article className="update-detail">
        <Link className="inline-action" href="/updates">Back to updates</Link>
        <p className="eyebrow">{update.kind}</p>
        <h1>{update.title}</h1>
        <time dateTime={update.publishedAt}>
          {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(update.publishedAt))}
        </time>
        <p>{update.summary}</p>
      </article>
    </main>
  );
};

export default UpdatePage;
