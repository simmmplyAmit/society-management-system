"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <span className="animate-pop text-base leading-none">✅</span>,
        info: <span className="animate-pop text-base leading-none">💡</span>,
        warning: <span className="animate-pop text-base leading-none">⚠️</span>,
        error: <span className="animate-pop text-base leading-none">😕</span>,
        loading: <span className="emoji-float text-base leading-none">⏳</span>,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
