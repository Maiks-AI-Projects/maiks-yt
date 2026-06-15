const ContextPage = (): React.ReactNode => (
  <main className="content-page">
    <header className="links-header">
      <p className="eyebrow">Creator-provided context</p>
      <h1>Personal Context</h1>
      <p>This page is Michael&apos;s place to share selected personal context in his own words. It is not medical or legal guidance.</p>
    </header>

    <aside className="content-notice" aria-label="Draft status">
      This is a restrained public draft. Michael can revise or remove any detail before release.
    </aside>

    <section>
      <h2>Context around streaming</h2>
      <p>Michael has health issues that can affect streaming. Streams may sometimes be irregular, shorter, cancelled, or lower energy.</p>
      <p>This page does not name conditions, interpret symptoms, or explain individual cancellations.</p>
    </section>

    <section>
      <h2>Family and home life</h2>
      <p>Michael lives next to his ex-wife and has his son half of the time. Those responsibilities are part of the context around his schedule and availability.</p>
    </section>

    <section>
      <h2>Boundaries</h2>
      <p>Sharing broad context does not make every personal detail public. Stream updates can stay brief, and Michael can decide what to explain case by case.</p>
    </section>
  </main>
);

export default ContextPage;
