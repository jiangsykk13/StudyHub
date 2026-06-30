import { AuthForm } from "../auth-form";

export default function LoginPage() {
  return (
    <AuthForm
      title="Log in"
      description="Use your invited account to access private course materials."
      submitLabel="Log in"
      endpoint="/api/auth/login"
      fields={[
        { id: "email", label: "Email", type: "email", autoComplete: "email" },
        { id: "password", label: "Password", type: "password", autoComplete: "current-password" }
      ]}
    />
  );
}
