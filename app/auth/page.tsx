"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Image from "next/image";
import logoLight from "@/public/logo_light.png";
import logoDark from "@/public/logo_dark.png";
import Link from "next/link";

export default function AuthPage() {
  const router = useRouter();
  const { user, login, register, loading, loginWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  if (loading || user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, username, password);
      }
      setEmail("");
      setUsername("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    if (credentialResponse.credential) {
      try {
        await loginWithGoogle(credentialResponse.credential);
      } catch (error) {
        console.error("Failed to log in with Google", error);
        setError(
          error instanceof Error ? error.message : "Google Login failed",
        );
      }
    }
  };

  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
      <div className="grid min-h-svh lg:grid-cols-2 ">
        {/* Left column */}
        <div className="flex flex-col gap-4 p-6 md:p-10">
          {/* Brand */}
          <div className="flex justify-center gap-2 md:justify-start">
            <Link href="/" className="flex items-center gap-2 font-medium">
              <div className="flex items-center gap-3">
                <Image
                  src={logoLight}
                  alt="Clarity"
                  width={118}
                  height={28}
                  sizes="118px"
                  className="dark:hidden"
                />
                <Image
                  src={logoDark}
                  alt="Clarity"
                  width={118}
                  height={28}
                  sizes="118px"
                  className="hidden dark:block"
                />
              </div>
            </Link>
          </div>

          {/* Form area */}
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="w-full max-w-xs ">
              <form
                onSubmit={handleSubmit}
                className={cn("flex flex-col gap-6")}>
                {/* Heading */}
                <div className="flex flex-col items-center gap-2 text-center">
                  <h1 className="text-2xl font-bold">
                    {isLogin ? "Login to your account" : "Create an account"}
                  </h1>
                  <p className="text-balance text-sm text-muted-foreground">
                    {isLogin
                      ? "Enter your email below to login to your account"
                      : "Enter your details below to create your account"}
                  </p>
                </div>

                <div className="grid gap-6">
                  {/* Email */}

                  {/* Username (sign-up only) */}
                  {!isLogin && (
                    <div className="grid gap-2">
                      <label
                        htmlFor="username"
                        className="text-sm font-medium leading-none">
                        Username
                      </label>
                      <Input
                        id="username"
                        type="text"
                        placeholder="Choose a username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                  )}
                  <div className="grid gap-2">
                    <label
                      htmlFor="email"
                      className="text-sm font-medium leading-none">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  {/* Password */}
                  <div className="grid gap-2">
                    <div className="flex items-center">
                      <label
                        htmlFor="password"
                        className="text-sm font-medium leading-none">
                        Password
                      </label>
                      {isLogin && (
                        <Link href="#" className="ml-auto  ">
                          <Button
                            variant="subtle"
                            className="text-xs hover:underline underline-offset-4">
                            {" "}
                            Forgot your password?
                          </Button>
                        </Link>
                      )}
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                      <p className="text-sm text-destructive">{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting}>
                    {submitting
                      ? "Please wait..."
                      : isLogin
                        ? "Login"
                        : "Create Account"}
                  </Button>
                </div>

                {/* Toggle */}
                <div className="text-center text-sm">
                  {isLogin ? (
                    <>
                      Don&apos;t have an account?{" "}
                      <Button
                        variant="subtle"
                        onClick={() => {
                          setIsLogin(false);
                          setError("");
                        }}
                        className="-ml-3 hover:text-primary">
                        Sign up
                      </Button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <Button
                        variant="subtle"
                        className="-ml-3"
                        onClick={() => {
                          setIsLogin(true);
                          setError("");
                        }}>
                        Login
                      </Button>
                    </>
                  )}
                </div>
              </form>
            </div>
            <div className="relative flex w-full max-w-xs items-center my-2">
              <div className="flex-1 border-t border-border" />
              <span className="mx-3 text-xs text-muted-foreground">or</span>
              <div className="flex-1 border-t border-border" />
            </div>
            <div className="w-full flex justify-center max-w-xs">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => console.log("Google Login Failed")}
                shape="pill"
                width="320px"
              />
            </div>
          </div>
        </div>

        {/* Right column — cover image, hidden on mobile */}
        <div className="relative hidden lg:block m-4">
          <Image
            src="/image.png"
            alt="Clarity cover"
            fill
            quality={100}
            priority
            className="rounded-sm object-cover object-left dark:hidden"
          />

          {/* Dark Mode Image */}
          <Image
            src="/image_dark.png"
            alt="Clarity cover dark"
            fill
            quality={100}
            priority
            className="hidden dark:block rounded-sm object-cover object-left dark:brightness-[0.2] dark:grayscale"
          />
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}
