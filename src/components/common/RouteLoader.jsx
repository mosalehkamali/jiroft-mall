import { loaderArtwork } from "./loaderArtwork";
import styles from "./RouteLoader.module.css";

export default function RouteLoader() {
  return (
    <div
      className={styles.overlay}
      role="status"
      aria-label="در حال بارگذاری"
      dangerouslySetInnerHTML={{ __html: loaderArtwork }}
    />
  );
}
