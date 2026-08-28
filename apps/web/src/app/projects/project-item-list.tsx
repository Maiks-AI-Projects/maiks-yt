import type { PublicProjectItem } from "@maiks-yt/domain/projects";

import { getPublicProjectItemKey, getPublicProjectItemLinkKey } from "./project-public-keys.rules";
import { formatProjectLabel } from "./project-read-data";
import styles from "./projects.module.css";

const formatEstimate = (item: PublicProjectItem): string | null =>
  item.estimatedMinorAmount !== undefined && item.currencyCode
    ? new Intl.NumberFormat("en", {
      style: "currency",
      currency: item.currencyCode
    }).format(item.estimatedMinorAmount / 100)
    : null;

export const ProjectItemList = ({
  items,
  nested = false,
  path = []
}: {
  items: readonly PublicProjectItem[];
  nested?: boolean;
  path?: readonly number[];
}): React.ReactNode => (
  <ul className={nested ? styles.nestedItemList : styles.itemList}>
    {items.map((item, index) => {
      const estimate = formatEstimate(item);
      const itemPath = [...path, index];
      const itemKey = getPublicProjectItemKey(item, itemPath);

      return (
        <li className={styles.item} key={itemKey}>
          <div className={styles.itemMeta}>
            <span>{formatProjectLabel(item.kind)}</span>
            <span>{formatProjectLabel(item.status)}</span>
          </div>
          <strong>{item.title}</strong>
          {item.description ? <p>{item.description}</p> : null}
          {item.quantity > 1 || estimate ? (
            <div className={styles.itemFacts}>
              {item.quantity > 1 ? <span>Quantity {item.quantity}</span> : null}
              {estimate ? <span>Estimate {estimate}</span> : null}
            </div>
          ) : null}
          {item.links.length > 0 ? (
            <div className={styles.itemLinks}>
              {item.links.map((link, linkIndex) => (
                <a href={link.url} key={getPublicProjectItemLinkKey(link, itemKey, linkIndex)} rel="noreferrer" target="_blank">
                  {link.label}<span>{formatProjectLabel(link.relationship)}</span>
                </a>
              ))}
            </div>
          ) : null}
          {item.children.length > 0 ? <ProjectItemList items={item.children} nested path={itemPath} /> : null}
        </li>
      );
    })}
  </ul>
);
