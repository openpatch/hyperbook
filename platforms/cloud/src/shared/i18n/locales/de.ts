import type { Messages } from "./en";

/** The German catalog; tests/i18n.test.ts checks that it has every key of en. */
export const de: Messages = {
  common: {
    save: "Speichern",
    loading: "Laden…",
    language: "Sprache",
    automatic: "Automatisch",
    languages: { en: "English", de: "Deutsch" },
  },
  nav: {
    main: "Hauptnavigation",
    open: "Navigation öffnen",
    close: "Navigation schließen",
    books: "Bücher",
    users: "Benutzer",
    addresses: "Adressen",
    settings: "Einstellungen",
    activity: "Aktivität",
    account: "Ihr Konto",
    logOut: "Abmelden",
  },
  theme: {
    toLight: "Zum hellen Modus wechseln",
    toDark: "Zum dunklen Modus wechseln",
  },
  auth: {
    login: {
      title: "Anmelden",
      email: "E-Mail",
      password: "Passwort",
      submit: "Anmelden",
      forgot: "Passwort vergessen?",
      noAccount: "Noch kein Konto? Registrieren",
      resend: "Link erneut senden",
      resent: "Gesendet. Schauen Sie in Ihr E-Mail-Postfach.",
    },
    signup: {
      title: "Registrieren",
      domainsHint: "Für Adressen bei {{domains}}.",
      name: "Ihr Name",
      email: "E-Mail",
      password: "Passwort",
      passwordHint: "Mindestens 10 Zeichen.",
      confirm: "Passwort wiederholen",
      acceptPrivacy: "Ich akzeptiere die <a>Datenschutzerklärung</a>.",
      submit: "Registrieren",
      haveAccount: "Ich habe bereits ein Konto",
      sentTitle: "Schauen Sie in Ihr E-Mail-Postfach",
      sentBody:
        "Wir haben einen Link an <strong>{{email}}</strong> geschickt. Öffnen Sie ihn innerhalb von 24 Stunden, um Ihre Adresse zu bestätigen.",
      sentApproval:
        "Danach genehmigt ein Admin Ihr Konto; Sie bekommen eine E-Mail, sobald es so weit ist.",
      backToLogin: "Zurück zur Anmeldung",
    },
    forgot: {
      title: "Passwort vergessen?",
      noMail:
        "Diese Instanz kann keine E-Mails senden. Bitten Sie einen Admin, Ihr Passwort neu zu setzen.",
      hint: "Geben Sie Ihre E-Mail-Adresse ein und wir schicken Ihnen einen Link, um ein neues Passwort zu wählen.",
      email: "E-Mail",
      submit: "Link senden",
      backToLogin: "Zurück zur Anmeldung",
      sentTitle: "Schauen Sie in Ihr E-Mail-Postfach",
      sentBody:
        "Wenn für diese Adresse ein Konto existiert, liegt dort jetzt eine E-Mail mit einem Link, um ein neues Passwort zu wählen. Der Link funktioniert eine Stunde lang.",
    },
    reset: {
      title: "Neues Passwort wählen",
      inviteTitle: "Passwort wählen",
      doneTitle: "Passwort geändert",
      inviteDoneTitle: "Ihr Konto ist bereit",
      doneBody: "Sie können sich jetzt mit Ihrem neuen Passwort anmelden.",
      inviteDoneBody: "Sie können sich jetzt mit Ihrem Passwort anmelden.",
      login: "Anmelden",
      password: "Neues Passwort",
      passwordHint: "Mindestens 10 Zeichen.",
      confirm: "Neues Passwort wiederholen",
      submit: "Passwort ändern",
      inviteSubmit: "Passwort setzen",
    },
    verify: {
      confirming: "Ihre Adresse wird bestätigt…",
      failedTitle: "Dieser Link funktioniert nicht",
      login: "Anmelden",
      title: "Adresse bestätigt",
      pendingBody:
        "Ein Admin genehmigt Ihr Konto als Nächstes. Sie bekommen eine E-Mail, sobald es so weit ist.",
      readyBody: "Ihr Konto ist bereit.",
    },
  },
  account: {
    title: "Ihr Konto",
    profile: "Profil",
    name: "Name",
    nameHint:
      "Wird anderen Lehrkräften angezeigt, mit denen Sie Bücher teilen.",
    saved: "Gespeichert",
    storage: "Speicherplatz",
    password: "Passwort",
    currentPassword: "Aktuelles Passwort",
    newPassword: "Neues Passwort",
    passwordHint: "Mindestens 10 Zeichen.",
    confirm: "Neues Passwort wiederholen",
    changePassword: "Passwort ändern",
    passwordChanged: "Passwort geändert. Andere Geräte wurden abgemeldet.",
    language: "Sprache",
    languageHint:
      "Die Sprache der Seiten und E-Mails. „Automatisch“ folgt der Instanz und Ihrem Browser.",
  },
  instance: {
    language: "Sprache",
    languageHint:
      "Vorgabe für Benutzer, die keine gewählt haben. „Automatisch“ folgt dem Browser.",
  },
  landing: {
    title: "Power your Hyperbook",
    intro:
      "Hyperbook ist ein schneller und einfacher Weg, interaktive Arbeitshefte zu erstellen, die moderne Standards unterstützen und superschnell laufen. Schreiben Sie Markdown und erhalten Sie eine statische Website mit interaktiven Elementen — ganz ohne Programmiererfahrung.",
    waysToRun: "Möglichkeiten, Hyperbook zu betreiben",
    hostedTitle: "Gehostet von OpenPatch",
    hostedDescriptionSignup:
      "Kein eigener Server nötig: Auf dieser Instanz — hyperbook.cloud, betrieben von OpenPatch — erstellen Sie ein Konto und schreiben, veröffentlichen und teilen Ihre Bücher direkt im Browser.",
    hostedDescription:
      "Kein eigener Server nötig: Auf hyperbook.cloud, unserer öffentlichen Instanz, bekommen Sie ein Konto und schreiben, veröffentlichen und teilen Ihre Bücher direkt im Browser.",
    createAccount: "Konto erstellen",
    openHosted: "hyperbook.cloud öffnen",
    selfHostedTitle: "Selbst gehostet mit Docker",
    selfHostedDescription:
      "Betreiben Sie Ihre eigene Instanz in einem Container — SQLite plus ein Daten-Volume, pro Release als ghcr.io/openpatch/hyperbook-cloud veröffentlicht.",
    selfHostingGuide: "Anleitung zum Selbst-Hosten",
    cliTitle: "Mit der CLI überall deployen",
    cliDescription:
      "Erstellen Sie eine statische Website mit der Hyperbook-CLI und laden Sie den Ordner .hyperbook/out auf einem beliebigen Host hoch — GitHub Pages, Vercel, Ihrem eigenen Webserver.",
    hostingDocs: "Hosting-Dokumentation",
    signUp: "Registrieren",
    logIn: "Anmelden",
    builtWith: "Gebaut mit ❤️ von <a>OpenPatch</a>",
    documentation: "Dokumentation",
  },
  notFound: {
    title: "Seite nicht gefunden",
    back: "Zurück zu Ihren Büchern",
  },
  storage: {
    usedOf: "{{used}} von {{limit}}",
    noLimit: "{{used}} (kein Limit)",
    meter: "Belegter Speicherplatz",
    hint: "Zählt die Dateien aller eigenen Bücher; gebaute Websites zählen nicht.",
  },
  legal: {
    imprint: "Impressum",
    privacy: "Datenschutz",
    privacyPolicy: "Datenschutzerklärung",
  },
  mail: {
    verify: {
      subject: "Bestätigen Sie Ihre E-Mail-Adresse für {{name}}",
      body: "Willkommen bei {{name}}!\n\nUm Ihre Adresse zu bestätigen und die Registrierung abzuschließen, öffnen Sie innerhalb von 24 Stunden diesen Link:\n\n{{link}}\n\nWenn Sie sich nicht angemeldet haben, ignorieren Sie diese E-Mail; ohne Bestätigung wird kein Konto erstellt.",
    },
    reset: {
      subject: "Passwort zurücksetzen",
      body: "Jemand hat das Zurücksetzen des Passworts Ihres Kontos ({{email}}) angefordert.\n\nUm ein neues Passwort zu wählen, öffnen Sie innerhalb einer Stunde diesen Link:\n\n{{link}}\n\nWenn Sie das nicht waren, ignorieren Sie diese E-Mail; Ihr Passwort bleibt unverändert.",
    },
    signupExists: {
      subject: "Registrierung bei {{name}}",
      body: "Jemand hat versucht, sich bei {{name}} mit Ihrer Adresse zu registrieren, für die bereits ein Konto existiert.\n\nMelden Sie sich unter {{loginUrl}} an oder wählen Sie unter {{forgotUrl}} ein neues Passwort.\n\nWenn Sie das nicht waren, ignorieren Sie diese E-Mail.",
    },
    approval: {
      subject: "{{displayName}} wartet auf Genehmigung",
      body: "{{displayName}} ({{email}}) hat sich bei {{name}} registriert und wartet auf Ihre Genehmigung:\n\n{{usersUrl}}",
    },
    approved: {
      subject: "Ihr Konto bei {{name}} ist bereit",
      body: "Ein Admin hat Ihr Konto bei {{name}} genehmigt. Melden Sie sich unter {{loginUrl}} mit {{email}} an.",
    },
    invite: {
      subject: "Sie sind zu {{name}} eingeladen",
      body: "Hallo{{name}},\n\n{{by}} hat Sie zu {{instance}} hinzugefügt, wo Sie Hyperbooks schreiben und veröffentlichen können.\n\nWählen Sie innerhalb von 7 Tagen mit diesem Link Ihr Passwort:\n\n{{link}}\n\nDanach melden Sie sich unter {{loginUrl}} mit {{email}} an.",
    },
    slugRequest: {
      note: "\n\nNotiz des Admins:\n{{note}}",
      requested: {
        subject: "{{slug}}: Adresse für „{{title}}“ beantragt",
        body: "{{by}} beantragt die Adresse {{slug}} für „{{title}}“ bei {{name}}, derzeit unter {{origin}}.\n\n{{description}}\n\nEntscheiden Sie unter {{addressesUrl}}",
      },
      approved: {
        subject: "„{{title}}“ ist jetzt unter {{slug}} erreichbar",
        body: "Ein Admin bei {{name}} hat „{{title}}“ die beantragte Adresse gegeben: {{origin}}\n\nDie alte Adresse leitet dorthin weiter.{{note}}",
      },
      declined: {
        subject: "Adresse {{slug}} für „{{title}}“",
        body: "Ein Admin bei {{name}} hat „{{title}}“ die Adresse {{slug}} nicht gegeben. Das Buch bleibt unter {{origin}}.{{note}}\n\n{{bookUrl}}",
      },
      revoked: {
        subject: "„{{title}}“ umgezogen nach {{slug}}",
        body: "Ein Admin bei {{name}} hat „{{title}}“ die Adresse {{oldSlug}} wieder entzogen. Das Buch ist jetzt unter {{origin}}; die alte Adresse leitet dorthin weiter, bis sie einem anderen Buch gegeben wird.{{note}}",
      },
    },
  },
  editor: {
    ai: {
      title: "KI-Assistent",
      hint: "Hilft beim Schreiben dieser Seite. Antworten sind Vorschläge zum Kopieren; Dateiänderungen erscheinen als Diff, den Sie prüfen.",
      model: "Modell: {{model}}",
      modelLabel: "Modell",
      requests: "{{used}} von {{limit}} Anfragen heute",
      requestsTitle: "Heute verwendete Anfragen",
      requestsUnlimited: "{{used}} Anfragen heute",
      credits: "Noch {{left}} von {{limit}} Credits",
      creditsTitle:
        "KI-Credits diese Woche: Tokens mal Gewicht des Modells. Sie werden am {{date}} erneuert.",
      creditsUsed: "{{used}} Credits diese Woche verbraucht",
      modelWeight: "{{model}} (×{{weight}})",
      promptPlaceholder: "Fragen Sie zu dieser Seite — oder markieren Sie zuerst Text…",
      ask: "Fragen",
      stop: "Stopp",
      reviewProposal: "Vorgeschlagene Änderungen anzeigen",
      retry: "Fehlgeschlagene Anfrage wiederholen",
      openFileFirst: "Öffnen Sie zuerst eine Textdatei.",
      working: "Arbeitet…",
      reading: "{{name}}…",
      copy: "Kopieren",
      copied: "Kopiert.",
      length: "Die Antwort erreichte das Längenlimit. Fragen Sie nach mehr.",
      stopped: "Gestoppt.",
      proposalTitle: "Vorgeschlagene Änderungen prüfen",
      proposalHint:
        "Die Assistenz möchte diese Dateien ändern. Nehmen Sie an, was Sie möchten — oder lehnen Sie alles ab; nichts wird angewendet, bevor Sie entschieden haben.",
      include: "{{path}} einschließen",
      deleted: "gelöscht",
      newFile: "neue Datei",
      edited: "bearbeitet",
      openPage: "(die offene Seite)",
      referencedBy: "Referenziert von: {{files}}",
      accept: "{{count}} Änderung annehmen",
      accept_other: "{{count}} Änderungen annehmen",
      deny: "Alles ablehnen",
      applied:
        "Angewendet. Dateiänderungen sind ein Speichervorgang; die offene Seite wird hier bearbeitet.",
      denied: "Es wurde nichts geändert.",
      conflict:
        "Das Buch wurde inzwischen geändert, daher wurde nichts angewendet. Fragen Sie erneut.",
      pageChanged:
        "{{files}} wurde seit der Antwort geändert — es wurde nichts angewendet. Fragen Sie erneut.",
    },
  },
  errors: {
    generic: "Auf dem Server ist etwas schiefgegangen",
    notFound: "Nicht gefunden",
    notLoggedIn: "Nicht angemeldet",
    adminOnly: "Nur Admins dürfen das",
    invalidInput: "Ungültige Eingabe",
    auth: {
      tooManyAttempts:
        "Zu viele fehlgeschlagene Versuche. Versuchen Sie es in 15 Minuten erneut.",
      wrongCredentials: "E-Mail oder Passwort ist falsch",
      unverified:
        "Bestätigen Sie zuerst Ihre E-Mail-Adresse: folgen Sie dem Link, den wir geschickt haben.",
      pending:
        "Ihr Konto wartet auf die Genehmigung durch einen Admin. Sie bekommen eine E-Mail, sobald es so weit ist.",
      noMail:
        "Diese Instanz kann keine E-Mails senden. Bitten Sie einen Admin, Ihr Passwort neu zu setzen.",
      noMailShort: "Diese Instanz kann keine E-Mails senden.",
      linkExpired:
        "Dieser Link ist abgelaufen oder wurde bereits benutzt. Fordern Sie einen neuen an.",
      linkExpiredLogin:
        "Dieser Link ist abgelaufen oder wurde bereits benutzt. Melden Sie sich an, um einen neuen zu bekommen.",
      signupClosed:
        "Diese Instanz nimmt keine Registrierungen entgegen. Bitten Sie einen Admin um ein Konto.",
      signupDomains:
        "Die Registrierung ist nur für Adressen bei {{domains}} offen.",
      tooManySignups:
        "Gerade gibt es zu viele Registrierungen. Versuchen Sie es in einer Stunde erneut.",
    },
    me: {
      wrongCurrentPassword: "Das aktuelle Passwort ist falsch",
    },
    users: {
      notFound: "Benutzer nicht gefunden",
      emailExists: "Ein Konto mit dieser E-Mail-Adresse existiert bereits",
    },
    ai: {
      notConfigured:
        "Die KI-Unterstützung ist auf dieser Instanz nicht eingerichtet. Bitten Sie eine Admin darum.",
      disabled:
        "Eine Admin hat die KI-Unterstützung für Ihr Konto deaktiviert.",
      quota:
        "Ihre KI-Anfragen für heute sind aufgebraucht. Morgen stehen wieder neue zur Verfügung.",
      tokenQuota:
        "Ihre KI-Credits für diese Woche sind aufgebraucht. Am Montag stehen wieder neue zur Verfügung.",
      rateLimited:
        "Gerade zu viele KI-Anfragen. Versuchen Sie es in einer Minute erneut.",
      provider:
        "Der KI-Anbieter hat nicht geantwortet. Versuchen Sie es erneut.",
    },
  },
  validation: {
    email: "Geben Sie eine gültige E-Mail-Adresse ein",
    passwordMin: "Verwenden Sie mindestens 10 Zeichen",
    passwordMax: "Verwenden Sie höchstens 200 Zeichen",
    passwordRequired: "Geben Sie Ihr Passwort ein",
    aiPromptRequired: "Schreiben Sie, was die Assistenz tun soll",
    currentPasswordRequired: "Geben Sie Ihr aktuelles Passwort ein",
    nameRequired: "Geben Sie Ihren Namen ein",
    nameMax: "Verwenden Sie höchstens 100 Zeichen",
    acceptPrivacy:
      "Akzeptieren Sie die Datenschutzerklärung, um sich zu registrieren",
    passwordsMismatch: "Die Passwörter stimmen nicht überein",
  },
};
