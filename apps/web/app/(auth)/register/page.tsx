import { AuthForm } from "../auth-form";

export default function RegisterPage() {
  return (
    <AuthForm
      title="Register"
      description="Create an account with an invitation code from your course administrator."
      submitLabel="Create account"
      endpoint="/api/auth/register"
      fields={[
        { id: "invitationCode", label: "Invitation code", type: "text", autoComplete: "off" },
        { id: "displayName", label: "Display name", type: "text", autoComplete: "name" },
        { id: "email", label: "Email", type: "email", autoComplete: "email" },
        { id: "password", label: "Password", type: "password", autoComplete: "new-password" }
      ]}
    />
  );
}
