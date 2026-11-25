import styles from "./index.module.scss";
import type { SkeletonProperties } from "@sharadox/account-web-library/skeleton/type";

/**
 * Where data is still loading: soft gray lines (or a block) shaped like what will come, gently shimmering, so a page
 * shows at once and fills in. Screen readers hear `label` once.
 *
 * @example
 * <Suspense fallback={<Skeleton label="Loading devices…" lines={4} />}><DeviceList /></Suspense>
 */
export function Skeleton({ lines = 3, label, height }: SkeletonProperties) {
  return (
    <div className={styles.skeleton} role="status" aria-label={label}>
      {height ? (
        <span className={styles.block} style={{ height }} />
      ) : (
        Array.from({ length: lines }, (_, index) => <span key={index} className={styles.line} />)
      )}
    </div>
  );
}
