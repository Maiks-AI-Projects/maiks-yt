import { getPublicUpdateUrl, publicUpdates } from "../../content/public-updates";

const UpdatesPage = (): React.ReactNode => (
  <main className="updates-page">
    <header className="links-header">
      <p className="eyebrow">Updates</p>
      <h1>Public Updates</h1>
      <p>Project notes, stream context, and public posts that can also appear in the RSS feed.</p>
    </header>
    <section className="update-list" aria-label="Public updates">
      {publicUpdates.map((update) => (
        <article className="update-card" key={update.slug}>
          <span className="creator-link-kicker">{update.kind}</span>
          <h2>
            <a href={getPublicUpdateUrl(update)}>{update.title}</a>
          </h2>
          <time dateTime={update.publishedAt}>
            {new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date(update.publishedAt))}
          </time>
          <p>{update.summary}</p>
        </article>
      ))}
    </section>
  </main>
);

export default UpdatesPage;
