"use client";

import {
  FormField,
  FormInput,
  FormTextarea,
  PluginFormDialog,
} from "@radarboard/plugin-sdk/components/form-dialog";
import { PluginListHeader } from "@radarboard/plugin-sdk/components/list-header";
import { ListRowChip, PluginListRow } from "@radarboard/plugin-sdk/components/list-row";
import { PluginEmptyState } from "@radarboard/plugin-sdk/components/plugin-empty";
import type { PluginRenderProps } from "@radarboard/plugin-sdk/types";
import { Button } from "@radarboard/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@radarboard/ui/tooltip";
import { Bookmark as BookmarkIcon, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useBookmarks } from "../use-bookmarks";

export function BookmarksOverlay({ api }: PluginRenderProps) {
  const { bookmarks, loaded, addBookmark, deleteBookmark } = useBookmarks(api);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredBookmarks = useMemo(() => {
    if (!searchQuery.trim()) return bookmarks;
    const q = searchQuery.trim().toLowerCase();
    return bookmarks.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [bookmarks, searchQuery]);

  if (!loaded) {
    return <PluginEmptyState title="Loading bookmarks..." />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PluginListHeader
        label="Bookmarks"
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search bookmarks...",
        }}
        addButton={{
          label: "Add Bookmark",
          onClick: () => setShowForm(true),
        }}
        count={`${filteredBookmarks.length} bookmark${filteredBookmarks.length !== 1 ? "s" : ""}${searchQuery ? ` matching "${searchQuery}"` : ""}`}
      />

      {/* New bookmark dialog */}
      <BookmarkFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSubmit={async (input) => {
          await addBookmark(input);
          setShowForm(false);
          api.notify("Bookmark added", "success");
        }}
      />

      {/* Bookmark list */}
      <div className="flex-1 overflow-y-auto">
        {filteredBookmarks.length === 0 ? (
          <PluginEmptyState
            icon={<BookmarkIcon className="icon-lg" />}
            title={searchQuery ? "No bookmarks match your search" : "No bookmarks yet"}
            description={searchQuery ? undefined : "Add your first bookmark to get started."}
            action={
              searchQuery ? undefined : { label: "Add Bookmark", onClick: () => setShowForm(true) }
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {filteredBookmarks.map((bookmark) => (
              <PluginListRow
                key={bookmark.id}
                indicator={<BookmarkIcon className="icon-sm text-dim" />}
                title={bookmark.title}
                subtitle={bookmark.description}
                chips={
                  bookmark.tags.length > 0
                    ? bookmark.tags.map((tag) => <ListRowChip key={tag}>{tag}</ListRowChip>)
                    : undefined
                }
                onClick={() => window.open(bookmark.url, "_blank", "noopener,noreferrer")}
                actions={
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteBookmark(bookmark.id);
                        }}
                        variant="ghost"
                        size="icon"
                        uppercase={false}
                        className="text-dim hover:bg-red-400/10 hover:text-red-400"
                        aria-label="Delete bookmark"
                      >
                        <Trash2 className="icon-base" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bookmark form dialog
// ---------------------------------------------------------------------------

function BookmarkFormDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: { title: string; url: string; description?: string; tags?: string[] }) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const attachTitleInputRef = useCallback((node: HTMLInputElement | null) => {
    node?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    if (!title.trim() || !url.trim()) return;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSubmit({
      title: title.trim(),
      url: url.trim(),
      description: description.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    });
    setTitle("");
    setUrl("");
    setDescription("");
    setTagsInput("");
  }, [title, url, description, tagsInput, onSubmit]);

  return (
    <PluginFormDialog
      open={open}
      onClose={onClose}
      title="Add Bookmark"
      onSubmit={handleSubmit}
      submitLabel="Add"
      submitDisabled={!title.trim() || !url.trim()}
    >
      <FormField label="Title">
        <FormInput
          ref={attachTitleInputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bookmark title..."
        />
      </FormField>
      <FormField label="URL">
        <FormInput
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
        />
      </FormField>
      <FormField label="Description">
        <FormTextarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          rows={2}
        />
      </FormField>
      <FormField label="Tags">
        <FormInput
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Comma-separated tags..."
        />
      </FormField>
    </PluginFormDialog>
  );
}
