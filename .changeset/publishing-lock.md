---
"@hyperbook/cloud": minor
---

Books have a publishing lock, for exams and other material that must never be public. An owner (or an admin) disables publishing on the book's page; from then on the book can neither be published nor rolled back, an open request to publish is dropped, and a book that is live is taken offline at once. The lock is enforced where a build goes live, so a build that was already waiting or running when the lock was set does not publish the book either. Previews, builds and downloads keep working for the book's members, the book's card shows a badge, and the change is written to the audit log.
