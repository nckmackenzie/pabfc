import { useEffect, useState } from 'react'
import { useDebounceCallback } from 'usehooks-ts'
import { SearchIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

interface SearchProps {
  placeholder: string
  className?: string
  allowOnlySearch?: boolean
  parentClassName?: string
  onHandleSearch: (term: string) => void
  defaultValue?: string
}

export function Search({
  placeholder,
  className,
  defaultValue,
  parentClassName,
  onHandleSearch,
}: SearchProps) {
  const [searchValue, setSearchValue] = useState(defaultValue || '')

  // Update local state when defaultValue changes (e.g., when filters are reset)
  useEffect(() => {
    setSearchValue(defaultValue || '')
  }, [defaultValue])

  const handleSearch = useDebounceCallback((term: string) => {
    onHandleSearch(term)
  }, 500)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchValue(query)
    handleSearch(query.trim().length > 0 ? query : '')
  }

  return (
    <div
      className={cn('relative shrink-0 w-full md:max-w-lg', parentClassName)}
    >
      <label htmlFor="search" className="sr-only">
        Search
      </label>
      <input
        className={cn(
          'border-input placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-none transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 ',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          'pl-10',
          className,
        )}
        onChange={handleInputChange}
        placeholder={placeholder}
        value={searchValue}
        type="search"
      />
      <SearchIcon className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-500 peer-focus:text-gray-900" />
    </div>
  )
}
