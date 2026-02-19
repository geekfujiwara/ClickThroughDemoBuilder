import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button, MessageBar, MessageBarBody,
  Spinner, Text, makeStyles, tokens,
} from "@fluentui/react-components";
import AppSymbol from "@/components/common/AppSymbol";
import { useAuthStore } from "@/stores/authStore";

const GITHUB_URL =
  (import.meta.env.VITE_GITHUB_URL as string | undefined) ?? "https://github.com";

const useStyles = makeStyles({
  root: {
    minHeight: "100vh", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    background: tokens.colorNeutralBackground3,
    padding: tokens.spacingVerticalXL,
  },
  card: {
    width: "100%", maxWidth: "400px",
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    boxShadow: tokens.shadow16,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL,
  },
  header: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: tokens.spacingVerticalS, marginBottom: tokens.spacingVerticalS,
  },
  appName: { color: tokens.colorBrandForeground1, textAlign: "center", lineHeight: "1.2" },
  footer: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: tokens.spacingVerticalS, marginTop: tokens.spacingVerticalS,
    paddingTop: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  githubLink: {
    display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3, textDecoration: "none",
    fontSize: tokens.fontSizeBase200,
  },
});

export default function LoginPage() {
  const styles = useStyles();
  const navigate = useNavigate();
  const loginWithEntra = useAuthStore((s) => s.loginWithEntra);

  const [error, setError] = useState<string | null>(null);
  const [entraLoading, setEntraLoading] = useState(false);

  const handleMicrosoftLogin = async () => {
    setError(null);
    setEntraLoading(true);
    try {
      await loginWithEntra();
      navigate("/");
    } catch (err) {
      setError((err as Error).message || "Microsoft sign-in failed. Please try again.");
    } finally {
      setEntraLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.header}>
          <AppSymbol size={48} />
          <Text as="h1" size={500} weight="semibold" className={styles.appName}>
            Click Through{"\n"}Demo Builder
          </Text>
        </div>

        <Button
          appearance="primary"
          size="large"
          disabled={entraLoading}
          onClick={() => void handleMicrosoftLogin()}
          style={{ width: "100%", justifyContent: "center" }}
          icon={
            <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
          }
        >
          {entraLoading ? <Spinner size="tiny" label="Signing in..." /> : "Sign in with Microsoft"}
        </Button>

        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        <div className={styles.footer}>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={styles.githubLink}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub Repository
          </a>
        </div>
      </div>
    </div>
  );
}