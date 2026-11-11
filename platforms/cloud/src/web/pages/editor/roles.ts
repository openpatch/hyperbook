/** Whether a book role may change the book (editors and owners; not commenters). */
export function hasEditRole(role: "owner" | "editor" | "commenter"): boolean {
  return role !== "commenter";
}
