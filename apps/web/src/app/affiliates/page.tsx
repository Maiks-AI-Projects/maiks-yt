const AffiliatesPage = (): React.ReactNode => (
  <main className="content-page">
    <header className="links-header">
      <p className="eyebrow">Disclosure</p>
      <h1>Affiliate Links and Recommendations</h1>
      <p>Income-linked references and personal recommendations are separate categories on Maiks.yt.</p>
    </header>

    <aside className="content-notice disclosure-notice" aria-label="Affiliate disclosure">
      If a link can earn Michael money or another benefit, it will be visibly identified as an affiliate or income link near the link itself.
    </aside>

    <section>
      <h2>Income links</h2>
      <p>An income link has a commercial relationship attached to it. Its label should state that relationship before someone follows the link.</p>
      <p className="content-empty-state">No affiliate or income links are published yet.</p>
    </section>

    <section>
      <h2>Personal recommendations</h2>
      <p>A personal recommendation reflects Michael&apos;s own opinion and is not presented as an income link when no commercial relationship applies.</p>
      <p>A recommendation will not be described as independent if money, credit, a free product, or another benefit is connected to it.</p>
    </section>

    <section>
      <h2>Corrections</h2>
      <p>If a commercial relationship is missing or described incorrectly, the page or link can be corrected and the material change recorded in the public accountability history.</p>
    </section>
  </main>
);

export default AffiliatesPage;
