"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Mail, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  sendEmailCode,
  sendPhoneCode,
  verifyEmailCode,
  verifyPhoneCode,
} from "@/actions/verification";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  maskedEmail: string;
  emailVerified: boolean;
  initialPhone: string;
  phoneVerified: boolean;
}

export function VerifyContact({ maskedEmail, emailVerified, initialPhone, phoneVerified }: Props) {
  return (
    <div className="space-y-4">
      <EmailStep maskedEmail={maskedEmail} verified={emailVerified} />
      <PhoneStep initialPhone={initialPhone} verified={phoneVerified} />
    </div>
  );
}

function StepCard({
  icon: Icon,
  title,
  verified,
  children,
}: {
  icon: React.ElementType;
  title: string;
  verified: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-lg shadow-indigo-900/5">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-3">
          <span
            className={`flex size-9 items-center justify-center rounded-lg ${
              verified ? "bg-emerald-50 text-emerald-600" : "bg-primary/10 text-primary"
            }`}
          >
            {verified ? <CheckCircle2 className="size-[18px]" /> : <Icon className="size-[18px]" />}
          </span>
          <span className="text-sm font-semibold">{title}</span>
          {verified && <span className="ml-auto text-xs font-medium text-emerald-600">Verified</span>}
        </div>
        {!verified && children}
      </CardContent>
    </Card>
  );
}

function CodeEntry({
  sent,
  devCode,
  pending,
  onVerify,
  onResend,
}: {
  sent: boolean;
  devCode?: string;
  pending: boolean;
  onVerify: (code: string) => void;
  onResend: () => void;
}) {
  const [code, setCode] = useState("");
  if (!sent) return null;
  return (
    <div className="space-y-2">
      <Label htmlFor="otp">Enter the 6-digit code</Label>
      <Input
        id="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="123456"
        className="tracking-[0.4em]"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
      />
      {devCode && (
        <p className="text-xs text-amber-700">Dev mode, no provider configured. Code: {devCode}</p>
      )}
      <div className="flex gap-2">
        <Button type="button" className="flex-1" disabled={pending || code.length !== 6} onClick={() => onVerify(code)}>
          {pending ? "Checking…" : "Verify"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onResend}>
          Resend
        </Button>
      </div>
    </div>
  );
}

function EmailStep({ maskedEmail, verified }: { maskedEmail: string; verified: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string>();

  function send() {
    startTransition(async () => {
      const r = await sendEmailCode();
      if ("error" in r) return void toast.error(r.error);
      setSent(true);
      setDevCode(r.devCode);
      toast.success("Code sent to your email");
    });
  }

  function verify(code: string) {
    const fd = new FormData();
    fd.set("code", code);
    startTransition(async () => {
      const r = await verifyEmailCode(fd);
      if ("error" in r) return void toast.error(r.error);
      toast.success("Email verified");
      router.refresh();
    });
  }

  return (
    <StepCard icon={Mail} title="Email" verified={verified}>
      <p className="text-sm text-muted-foreground">We&apos;ll send a code to {maskedEmail}</p>
      {!sent && (
        <Button type="button" className="w-full" disabled={pending} onClick={send}>
          {pending ? "Sending…" : "Send code"}
        </Button>
      )}
      <CodeEntry sent={sent} devCode={devCode} pending={pending} onVerify={verify} onResend={send} />
    </StepCard>
  );
}

function PhoneStep({ initialPhone, verified }: { initialPhone: string; verified: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState(initialPhone);
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string>();

  function send() {
    const fd = new FormData();
    fd.set("phone", phone);
    startTransition(async () => {
      const r = await sendPhoneCode(fd);
      if ("error" in r) return void toast.error(r.error);
      setSent(true);
      setDevCode(r.devCode);
      toast.success("Code sent by SMS");
    });
  }

  function verify(code: string) {
    const fd = new FormData();
    fd.set("phone", phone);
    fd.set("code", code);
    startTransition(async () => {
      const r = await verifyPhoneCode(fd);
      if ("error" in r) return void toast.error(r.error);
      toast.success("Mobile number verified");
      router.refresh();
    });
  }

  return (
    <StepCard icon={Smartphone} title="Mobile number" verified={verified}>
      <div className="space-y-1.5">
        <Label htmlFor="phone">Mobile number</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="98765 43210"
          value={phone}
          disabled={sent}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      {!sent ? (
        <Button type="button" className="w-full" disabled={pending || !phone.trim()} onClick={send}>
          {pending ? "Sending…" : "Send code"}
        </Button>
      ) : (
        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setSent(false)}>
          Change number
        </button>
      )}
      <CodeEntry sent={sent} devCode={devCode} pending={pending} onVerify={verify} onResend={send} />
    </StepCard>
  );
}
