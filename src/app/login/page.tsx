import LoginFormClient from "@/components/LoginFormClient";
import { getRandomBgImage } from "@/lib/bg-images";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const bgImage = getRandomBgImage();

  return <LoginFormClient bgImage={bgImage} />;
}
