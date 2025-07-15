import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground hover:bg-success/90",
        warning: "bg-warning text-warning-foreground hover:bg-warning/90",
        error: "bg-error text-error-foreground hover:bg-error/90",
        doctor: "bg-doctor text-doctor-foreground hover:bg-doctor/90",
        patient: "bg-patient text-patient-foreground hover:bg-patient/90",
        prominent: "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg transition-all duration-200 ring-1 ring-blue-500/30 hover:ring-blue-500/50 dark:bg-blue-700 dark:hover:bg-blue-800 dark:ring-blue-400/30",
        "prominent-stop": "bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg transition-all duration-200 ring-1 ring-red-500/30 hover:ring-red-500/50 dark:bg-red-700 dark:hover:bg-red-800 dark:ring-red-400/30",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-6 px-1.5 md:px-3",
        lg: "h-11 px-8",
        icon: "md:h-10 h-8 md:w-10 w-8",
        xl: "h-14 px-10 text-lg font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants } 