import { generateCaptcha } from "@/lib/session";
import SignupFormClient from "@/components/SignupFormClient";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const { question, token } = await generateCaptcha();

  return (
    <SignupFormClient captchaQuestion={question} captchaToken={token} />
  );
}
