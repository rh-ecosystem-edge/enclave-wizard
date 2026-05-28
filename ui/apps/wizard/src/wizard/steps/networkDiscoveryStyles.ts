import { css } from "@emotion/css";

export const networkDiscoveryStyles = {
  connectionForm: css`
    max-width: 500px;
  `,

  summaryBar: css`
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--pf-t--global--background--color--secondary--default);
    border-radius: var(--pf-t--global--border--radius--small);
    margin-bottom: 1rem;
  `,

  summaryBadge: css`
    font-weight: 600;
  `,

  siteGrid: css`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 1rem;
  `,

  siteCard: css`
    cursor: default;
  `,

  inventoryList: css`
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--pf-t--global--text--color--subtle);
  `,

  inventoryItem: css`
    display: flex;
    justify-content: space-between;
    padding: 0.25rem 0;
    border-bottom: 1px solid var(--pf-t--global--border--color--default);
    &:last-child {
      border-bottom: none;
    }
  `,

  serverName: css`
    font-weight: 500;
    color: var(--pf-t--global--text--color--regular);
  `,

  serverDetail: css`
    font-size: 0.8125rem;
    color: var(--pf-t--global--text--color--subtle);
  `,

  labelChip: css`
    display: inline-block;
    padding: 0.125rem 0.375rem;
    margin-right: 0.25rem;
    font-size: 0.75rem;
    border-radius: var(--pf-t--global--border--radius--small);
    background: var(--pf-t--global--background--color--secondary--default);
    color: var(--pf-t--global--text--color--subtle);
  `,

  subnetRow: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem 0;
    font-size: 0.875rem;
  `,

  purposeBadge: css`
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-weight: 500;
  `,
};
