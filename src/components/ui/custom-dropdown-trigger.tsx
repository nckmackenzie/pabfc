import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreVerticalIcon } from '@/components/ui/icons'

export function CustomDropdownTrigger() {
  return (
    <DropdownMenuTrigger asChild>
      <button type="button" className="border-none outline-none cursor-pointer">
        <MoreVerticalIcon className="size-4 text-muted-foreground" />
      </button>
    </DropdownMenuTrigger>
  )
}
