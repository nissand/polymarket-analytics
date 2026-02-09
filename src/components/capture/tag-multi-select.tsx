"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface TagMultiSelectProps {
  selected: Array<{ id: string; label: string }>;
  onChange: (tags: Array<{ id: string; label: string }>) => void;
}

export function TagMultiSelect({ selected, onChange }: TagMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const tags = useQuery(api.categories.list);

  const toggleTag = (tag: { polymarketTagId: string; label: string }) => {
    const exists = selected.find((t) => t.id === tag.polymarketTagId);
    if (exists) {
      onChange(selected.filter((t) => t.id !== tag.polymarketTagId));
    } else {
      onChange([...selected, { id: tag.polymarketTagId, label: tag.label }]);
    }
  };

  const removeTag = (id: string) => {
    onChange(selected.filter((t) => t.id !== id));
  };

  if (!tags) {
    return <Skeleton className="h-10 w-full" />;
  }

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selected.length > 0
              ? `${selected.length} categor${selected.length === 1 ? "y" : "ies"} selected`
              : "Select categories..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search categories..." />
            <CommandList>
              <CommandEmpty>No categories found.</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {tags.map((tag) => (
                  <CommandItem
                    key={tag.polymarketTagId}
                    value={tag.label}
                    onSelect={() => toggleTag(tag)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected.find((t) => t.id === tag.polymarketTagId)
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                    {tag.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="gap-1">
              {tag.label}
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeTag(tag.id)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
