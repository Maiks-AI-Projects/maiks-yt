"use client";

import * as Tooltip from "@radix-ui/react-tooltip";

import styles from "./account.module.css";

type AccountControlTooltipProps = {
  children: React.ReactNode;
  text: string;
};

const AccountControlTooltip = ({ children, text }: AccountControlTooltipProps): React.ReactNode => (
  <Tooltip.Root delayDuration={250}>
    <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content className={styles.tooltip} side="top" sideOffset={8}>
        {text}
        <Tooltip.Arrow className={styles.tooltipArrow} />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
);

export default AccountControlTooltip;
