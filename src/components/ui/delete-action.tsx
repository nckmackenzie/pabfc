import { ActionButton } from '@/components/ui/action-button'
import { DeleteAction } from '@/components/ui/custom-button'
import { useDelete } from '@/hooks/use-delete'
import { cn } from '@/lib/utils'

type DeleteActionButtonProps = {
  resourceId: string
  deleteAction: (params: { data: string }) => Promise<void>
  queryKey: string[]
  successMessage?: string
  fallbackMessage?: string
  className?: string
  children?: React.ReactNode
}

export function DeleteActionButton({
  resourceId,
  deleteAction,
  queryKey,
  successMessage,
  fallbackMessage,
  className,
  children,
}: DeleteActionButtonProps) {
  const deleteHandler = useDelete()

  const handleDelete = async () => {
    return await deleteHandler(resourceId, deleteAction, {
      queryKey,
      successMessage,
      fallbackMessage,
    })
  }

  return (
    <ActionButton
      variant="ghost"
      action={handleDelete}
      requireAreYouSure
      className={cn(
        'px-1.5 py-1.5 justify-start h-auto w-full flex transition-colors hover:bg-destructive/20! focus:outline-0',
        className,
      )}
    >
      {children ?? <DeleteAction />}
    </ActionButton>
  )
}
