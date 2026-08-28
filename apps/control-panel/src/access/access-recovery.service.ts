export const createAccessRecoveryUrl = ({
  currentHref,
  webBaseUrl
}: {
  currentHref: string;
  webBaseUrl: string;
}): string => {
  const currentUrl = new URL(currentHref);
  currentUrl.search = "";
  currentUrl.hash = "";

  const recoveryUrl = new URL("/access/recovery", webBaseUrl);
  recoveryUrl.searchParams.set("returnTo", currentUrl.toString());

  return recoveryUrl.toString();
};
