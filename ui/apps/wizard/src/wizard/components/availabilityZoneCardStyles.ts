import { css } from "@emotion/css";

export const availabilityZoneCardStyles = {
  grid: css`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-top: 0.5rem;
  `,

  siteSelector: css`
    grid-column: 1 / -1;
    margin-bottom: 0.25rem;
  `,

  assignedServers: css`
    grid-column: 1 / -1;
    margin-top: 0.25rem;
  `,

  serverChip: css`
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    margin: 0.125rem;
    font-size: 0.8125rem;
    border-radius: var(--pf-t--global--border--radius--small);
    background: var(--pf-t--global--background--color--secondary--default);
    color: var(--pf-t--global--text--color--regular);
  `,

  serverDetail: css`
    font-size: 0.75rem;
    color: var(--pf-t--global--text--color--subtle);
  `,

  vpcField: css`
    grid-column: 1 / -1;
  `,
};
