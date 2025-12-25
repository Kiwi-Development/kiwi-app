"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { toast } from "sonner";

export function SignUpModal() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if the URL has the signup parameter or if we are in a recovery flow (which happens after clicking invite link)
    // Invite links usually redirect to a URL with an access token, handled by Supabase client.
    // However, if we want to explicitly show this modal, we can look for a param.
    // Assuming the user clicks a link like /?signup=true
    if (searchParams.get("signup") === "true") {
      setOpen(true);
    }
  }, [searchParams]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // If the user is already authenticated (via the invite link), we update their password.
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast.success("Password set successfully");
      setOpen(false);
      router.push("/dashboard/tests");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to set password";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Set your password</DialogTitle>
          <DialogDescription>
            Please set a password to complete your account setup.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSignUp} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="grid gap-2">
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Setting password..." : "Set Password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
