import LoginFormClient from "@/components/LoginFormClient";
import { getRandomBgImage } from "@/lib/bg-images";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const bgImage = await getRandomBgImage();

  return <LoginFormClient bgImage={bgImage} />;
}
