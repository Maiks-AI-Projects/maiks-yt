const AccountabilityPage = (): React.ReactNode => (
  <main className="content-page">
    <header className="links-header">
      <p className="eyebrow">Public record</p>
      <h1>Accountability and History</h1>
      <p>This page provides a stable structure for public project history and corrections. No history entries have been published yet.</p>
    </header>

    <section>
      <h2>Project history</h2>
      <p>Completed, changed, paused, or cancelled projects can be recorded here with dates, outcomes, and links to the original public updates.</p>
      <p className="content-empty-state">No project history entries yet.</p>
    </section>

    <section>
      <h2>Withdrawals and spending</h2>
      <p>If approved money features are introduced later, public records can explain relevant withdrawals and project spending without exposing private financial data.</p>
      <p className="content-empty-state">No money features or records are active.</p>
    </section>

    <section>
      <h2>Corrections</h2>
      <p>Material corrections to public claims or project records can be listed with the original statement, the correction, and the date of the change.</p>
      <p className="content-empty-state">No corrections published.</p>
    </section>

    <section>
      <h2>Archived outcomes</h2>
      <p>Older outcomes can remain available here after they leave active project pages, including plans that did not proceed.</p>
      <p className="content-empty-state">No archived outcomes yet.</p>
    </section>
  </main>
);

export default AccountabilityPage;
