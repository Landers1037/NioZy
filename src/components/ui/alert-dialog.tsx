import * as React from 'react'
import { useEffect } from 'react'
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import { acquireLinkPreviewOverlaySuppression } from '@/lib/link-preview-overlay'
import { scheduleReleaseStuckBodyScrollLock } from '@/lib/body-scroll-lock'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import {
  dialogContentClass,
  dialogOverlayClass,
  UI_DIALOG_OVERLAY,
  useDialogAnimationEnabled,
} from '@/lib/dialog-animations'

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger
const AlertDialogPortal = AlertDialogPrimitive.Portal

const AlertDialogOverlay = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const animate = useDialogAnimationEnabled()
  return (
    <AlertDialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 no-drag',
        UI_DIALOG_OVERLAY,
        dialogOverlayClass(animate),
        className,
      )}
      {...props}
    />
  )
})
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName

const AlertDialogContent = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, onCloseAutoFocus, ...props }, ref) => {
  const animate = useDialogAnimationEnabled()

  useEffect(() => {
    const releasePreview = acquireLinkPreviewOverlaySuppression()
    return () => {
      releasePreview()
      scheduleReleaseStuckBodyScrollLock()
    }
  }, [])

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        className={cn(
          'ui-overlay-panel pointer-events-auto fixed inset-0 z-50 m-auto h-fit w-full max-w-md max-h-[min(90vh,calc(100%-2rem))] overflow-hidden rounded-lg border border-border bg-card p-6 no-drag',
          dialogContentClass(animate),
          className,
        )}
        {...props}
        onCloseAutoFocus={(e) => {
          onCloseAutoFocus?.(e)
          e.preventDefault()
        }}
      />
    </AlertDialogPortal>
  )
})
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />
)

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
    {...props}
  />
)

const AlertDialogTitle = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn('ui-card-title text-lg font-bold', className)}
    {...props}
  />
))
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName

const AlertDialogDescription = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName

const AlertDialogAction = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants(), className)}
    {...props}
  />
))
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName

const AlertDialogCancel = React.forwardRef<
  React.ComponentRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: 'outline' }), className)}
    {...props}
  />
))
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
