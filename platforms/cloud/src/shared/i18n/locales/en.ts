/**
 * The English message catalog: the source of truth for the shape of every
 * other locale (de.ts is typed against it) and for the typed message keys.
 * Plain TS, not JSON, so web and server import the same file and TypeScript
 * checks the keys.
 */
export const en = {
  common: {
    save: "Save",
    loading: "Loading…",
    language: "Language",
    /** Follow the instance setting, then the browser. */
    automatic: "Automatic",
    languages: { en: "English", de: "Deutsch" },
  },
  nav: {
    main: "Main navigation",
    open: "Open navigation",
    close: "Close navigation",
    books: "Books",
    users: "Users",
    addresses: "Addresses",
    settings: "Settings",
    activity: "Activity",
    account: "Your account",
    logOut: "Log out",
  },
  theme: {
    toLight: "Switch to light mode",
    toDark: "Switch to dark mode",
  },
  auth: {
    login: {
      title: "Log in",
      email: "Email",
      password: "Password",
      submit: "Log in",
      forgot: "Forgot your password?",
      noAccount: "No account yet? Sign up",
      resend: "Send the link again",
      resent: "Sent. Check your email.",
    },
    signup: {
      title: "Sign up",
      domainsHint: "For addresses at {{domains}}.",
      name: "Your name",
      email: "Email",
      password: "Password",
      passwordHint: "At least 10 characters.",
      confirm: "Repeat the password",
      acceptPrivacy: "I accept the <a>privacy policy</a>.",
      submit: "Sign up",
      haveAccount: "I have an account",
      sentTitle: "Check your email",
      sentBody: "We sent a link to <strong>{{email}}</strong>. Open it within 24 hours to confirm your address.",
      sentApproval: "After that, an admin approves your account; you get an email when it is ready.",
      backToLogin: "Back to log in",
    },
    forgot: {
      title: "Forgot your password?",
      noMail: "This instance cannot send email. Ask an admin to set a new password for you.",
      hint: "Enter your email address and we will send you a link to choose a new one.",
      email: "Email",
      submit: "Send link",
      backToLogin: "Back to log in",
      sentTitle: "Check your email",
      sentBody:
        "If an account exists for that address, it now has an email with a link to choose a new password. The link works for one hour.",
    },
    reset: {
      title: "Choose a new password",
      inviteTitle: "Choose your password",
      doneTitle: "Password changed",
      inviteDoneTitle: "Your account is ready",
      doneBody: "You can now log in with your new password.",
      inviteDoneBody: "You can now log in with your password.",
      login: "Log in",
      password: "New password",
      passwordHint: "At least 10 characters.",
      confirm: "Repeat the new password",
      submit: "Change password",
      inviteSubmit: "Set password",
    },
    verify: {
      confirming: "Confirming your address…",
      failedTitle: "This link does not work",
      login: "Log in",
      title: "Address confirmed",
      pendingBody: "An admin approves your account next. You get an email when it is ready.",
      readyBody: "Your account is ready.",
    },
  },
  account: {
    title: "Your account",
    profile: "Profile",
    name: "Name",
    nameHint: "Shown to other teachers you share books with.",
    saved: "Saved",
    storage: "Storage",
    password: "Password",
    currentPassword: "Current password",
    newPassword: "New password",
    passwordHint: "At least 10 characters.",
    confirm: "Repeat the new password",
    changePassword: "Change password",
    passwordChanged: "Password changed. Other devices have been logged out.",
    language: "Language",
    languageHint: "The language of the pages and emails. “Automatic” follows the instance and your browser.",
  },
  instance: {
    language: "Language",
    languageHint: "Default for users who have not chosen one. “Automatic” follows the browser.",
  },
  landing: {
    title: "Power your Hyperbook",
    intro:
      "Hyperbook is a quick and easy way to build interactive workbooks that support modern standards and run superfast. Write Markdown, get a static site with interactive elements — no coding experience needed.",
    waysToRun: "Ways to run Hyperbook",
    hostedTitle: "Hosted by OpenPatch",
    hostedDescriptionSignup:
      "No server of your own needed: on this instance — hyperbook.cloud, run by OpenPatch — you create an account and write, publish and share your books right in the browser.",
    hostedDescription:
      "No server of your own needed: on hyperbook.cloud, our public instance, you get an account and write, publish and share your books right in the browser.",
    createAccount: "Create an account",
    openHosted: "Open hyperbook.cloud",
    selfHostedTitle: "Self-hosted with Docker",
    selfHostedDescription:
      "Run your own instance in one container — SQLite plus one data volume, published per release as ghcr.io/openpatch/hyperbook-cloud.",
    selfHostingGuide: "Self-hosting guide",
    cliTitle: "Deploy anywhere with the CLI",
    cliDescription:
      "Build a static site with the Hyperbook CLI and upload the .hyperbook/out folder to any host — GitHub Pages, Vercel, your own web server.",
    hostingDocs: "Hosting docs",
    signUp: "Sign up",
    logIn: "Log in",
    builtWith: "Built with ❤️ by <a>OpenPatch</a>",
    documentation: "Documentation",
  },
  notFound: {
    title: "Page not found",
    back: "Back to your books",
  },
  storage: {
    usedOf: "{{used}} of {{limit}}",
    noLimit: "{{used}} (no limit)",
    meter: "Storage used",
    hint: "Counts the files of all books owned; built websites do not count.",
  },
  legal: {
    imprint: "Imprint",
    privacy: "Privacy",
    privacyPolicy: "Privacy policy",
  },
  mail: {
    verify: {
      subject: "Confirm your email address for {{name}}",
      body: "Welcome to {{name}}!\n\nTo confirm your address and finish signing up, open this link within 24 hours:\n\n{{link}}\n\nIf you did not sign up, ignore this email; no account is made without the confirmation.",
    },
    reset: {
      subject: "Reset your password",
      body: "Someone asked to reset the password of your account ({{email}}).\n\nTo choose a new password, open this link within one hour:\n\n{{link}}\n\nIf this was not you, ignore this email; your password stays the same.",
    },
    signupExists: {
      subject: "Sign-up at {{name}}",
      body: "Someone tried to sign up at {{name}} with your address, which has an account already.\n\nLog in at {{loginUrl}}, or choose a new password at {{forgotUrl}}.\n\nIf this was not you, ignore this email.",
    },
    approval: {
      subject: "{{displayName}} waits for approval",
      body: "{{displayName}} ({{email}}) signed up at {{name}} and waits for your approval:\n\n{{usersUrl}}",
    },
    approved: {
      subject: "Your account at {{name}} is ready",
      body: "An admin approved your account at {{name}}. Log in at {{loginUrl}} with {{email}}.",
    },
    invite: {
      subject: "You are invited to {{name}}",
      body: "Hello{{name}},\n\n{{by}} added you to {{instance}}, where you can write and publish hyperbooks.\n\nChoose your password within 7 days with this link:\n\n{{link}}\n\nAfterwards you log in at {{loginUrl}} with {{email}}.",
    },
    slugRequest: {
      note: "\n\nNote from the admin:\n{{note}}",
      requested: {
        subject: "{{slug}}: address requested for “{{title}}”",
        body: "{{by}} asks for the address {{slug}} for “{{title}}” at {{name}}, now at {{origin}}.\n\n{{description}}\n\nDecide at {{addressesUrl}}",
      },
      approved: {
        subject: "“{{title}}” is now at {{slug}}",
        body: "An admin at {{name}} gave “{{title}}” the address you asked for: {{origin}}\n\nThe old address redirects there.{{note}}",
      },
      declined: {
        subject: "Address {{slug}} for “{{title}}”",
        body: "An admin at {{name}} did not give “{{title}}” the address {{slug}}. The book stays at {{origin}}.{{note}}\n\n{{bookUrl}}",
      },
      revoked: {
        subject: "“{{title}}” moved to {{slug}}",
        body: "An admin at {{name}} took back the address {{oldSlug}} from “{{title}}”. The book is now at {{origin}}; the old address redirects there until it is given to another book.{{note}}",
      },
    },
  },
  errors: {
    generic: "Something went wrong on the server",
    notFound: "Not found",
    notLoggedIn: "Not logged in",
    adminOnly: "Only admins may do this",
    invalidInput: "Invalid input",
    auth: {
      tooManyAttempts: "Too many failed attempts. Try again in 15 minutes.",
      wrongCredentials: "Email or password is wrong",
      unverified: "Confirm your email address first: follow the link we sent you.",
      pending: "Your account waits for an admin's approval. You get an email when it is approved.",
      noMail: "This instance cannot send email. Ask an admin to reset your password.",
      noMailShort: "This instance cannot send email.",
      linkExpired: "This link has expired or was already used. Ask for a new one.",
      linkExpiredLogin: "This link has expired or was already used. Log in to get a new one.",
      signupClosed: "This instance does not take sign-ups. Ask an admin for an account.",
      signupDomains: "Sign-up is open to addresses at {{domains}} only.",
      tooManySignups: "Too many sign-ups right now. Try again in an hour.",
    },
    me: {
      wrongCurrentPassword: "The current password is wrong",
    },
    users: {
      notFound: "User not found",
      emailExists: "An account with this email exists already",
    },
  },
  validation: {
    email: "Enter a valid email address",
    passwordMin: "Use at least 10 characters",
    passwordMax: "Use at most 200 characters",
    passwordRequired: "Enter your password",
    currentPasswordRequired: "Enter your current password",
    nameRequired: "Enter your name",
    nameMax: "Use at most 100 characters",
    acceptPrivacy: "Accept the privacy policy to sign up",
    passwordsMismatch: "The passwords do not match",
  },
};

/** The catalog shape; de.ts is checked against it, so a missing key is a compile error. */
export type Messages = typeof en;
