import styles from "./admin-navigation.module.css";

const AdminLoadingPage = (): React.ReactNode => (
  <main className={styles.restrictedContent} aria-live="polite">
    <p className={styles.restrictedEyebrow}>Loading</p>
    <h1>Loading admin</h1>
    <p>Admin content stays inside the private portal shell while this route gets ready.</p>
  </main>
);

export default AdminLoadingPage;
