'use client'

import { Link } from '@tanstack/react-router'
import type { VariantProps } from 'class-variance-authority'
import type { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import type { Route } from '@/types/index.types'

export function BackLink({
  children,
  className,
  variant = 'outline',
  size,
  href,
}: {
  children: React.ReactNode
  className?: string
  variant?: VariantProps<typeof buttonVariants>['variant']
  size?: VariantProps<typeof buttonVariants>['size']
  href?: Route
}) {
  return (
    <Button
      variant={variant}
      size={size || 'sm'}
      className={cn('', className)}
      asChild
    >
      <Link to={href ?? '..'}>
        <ArrowLeftIcon />
        {children}
      </Link>
    </Button>
  )
}

export function ButtonLink({
  path,
  children,
  className,
  variant = 'secondary',
  icon,
}: {
  path: Route
  children?: React.ReactNode
  className?: string
  variant?: VariantProps<typeof buttonVariants>['variant']
  icon?: React.ReactNode
}) {
  return (
    <Button variant={variant} asChild className={className} size="lg">
      <Link to={path}>
        {icon}
        {children || 'Create'}
      </Link>
    </Button>
  )
}
