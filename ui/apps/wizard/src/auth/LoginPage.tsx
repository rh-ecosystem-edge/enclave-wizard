import { css } from "@emotion/css";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Form,
  FormGroup,
  TextInput,
  Title,
} from "@patternfly/react-core";
import type React from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RedHatLogo } from "../common/components/RedHatLogo.tsx";
import { useAuth } from "./AuthContext.tsx";
import { ChangePasswordDialog } from "./ChangePasswordDialog.tsx";

const styles = {
  root: css`
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background-color: #e8e9eb;
  `,

  card: css`
    width: 100%;
    max-width: 28rem;
    padding: 2rem;
  `,

  logoWrap: css`
    display: flex;
    justify-content: center;
    margin-bottom: 2rem;
  `,

  title: css`
    text-align: center;
    margin-bottom: 1.5rem;
  `,

  alert: css`
    margin-bottom: 1rem;
  `,

  submitRow: css`
    margin-top: 1.5rem;
  `,
};

export const LoginPage: React.FC = () => {
  const { isAuthenticated, mustChangePassword, login } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !mustChangePassword) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, mustChangePassword, navigate]);

  useEffect(() => {
    if (isAuthenticated && mustChangePassword) {
      setShowChangePassword(true);
    }
  }, [isAuthenticated, mustChangePassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.root}>
      <Card className={styles.card}>
        <CardBody>
          <div className={styles.logoWrap}>
            <RedHatLogo width={220} />
          </div>

          <Title headingLevel="h1" size="xl" className={styles.title}>
            Sign in to Enclave Wizard
          </Title>

          {error && (
            <Alert
              variant="danger"
              title={error}
              isInline
              className={styles.alert}
            />
          )}

          <Form onSubmit={handleSubmit}>
            <FormGroup label="Username" fieldId="login-username">
              <TextInput
                id="login-username"
                value="admin"
                isDisabled
                aria-label="Username"
              />
            </FormGroup>

            <FormGroup label="Password" fieldId="login-password">
              <TextInput
                id="login-password"
                type="password"
                value={password}
                onChange={(_e, val) => setPassword(val)}
                autoFocus
                isRequired
                aria-label="Password"
              />
            </FormGroup>

            <div className={styles.submitRow}>
              <Button
                variant="primary"
                type="submit"
                isBlock
                isLoading={submitting}
                isDisabled={submitting || !password}
              >
                Sign in
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>

      {showChangePassword && (
        <ChangePasswordDialog currentPassword={password} />
      )}
    </div>
  );
};
