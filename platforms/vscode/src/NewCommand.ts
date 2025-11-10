import * as vscode from "vscode";
import * as path from "path";
import { createHyperbook, CreateHyperbookOptions } from "@hyperbook/create";

interface State {
  title: string;
  step: number;
  totalSteps: number;
  bookPath: string;
  name: string;
  description: string;
  author: string;
  authorUrl: string;
  license: string;
  language: string;
  platform: string;
}

const LICENSE_OPTIONS = [
  { label: "Creative Commons Zero (CC0)", value: "cc0" },
  { label: "Creative Commons Attribution (CC BY)", value: "cc-by" },
  { label: "Creative Commons Attribution-ShareAlike (CC BY-SA)", value: "cc-by-sa" },
  { label: "Creative Commons Attribution-NoDerivs (CC BY-ND)", value: "cc-by-nd" },
  { label: "Creative Commons Attribution-NonCommercial (CC BY-NC)", value: "cc-by-nc" },
  { label: "Creative Commons Attribution-NonCommercial-ShareAlike (CC BY-NC-SA)", value: "cc-by-nc-sa" },
  { label: "Creative Commons Attribution-NonCommercial-NoDervis (CC BY-NC-ND)", value: "cc-by-nc-nd" },
  { label: "Custom", value: "custom" },
];

const PLATFORM_OPTIONS = [
  { label: "GitHub", value: "github" },
  { label: "GitLab", value: "gitlab" },
  { label: "EduGit", value: "edugit" },
  { label: "Vercel", value: "vercel" },
  { label: "Custom/Other", value: "custom" },
];

export async function createNewHyperbook(context: vscode.ExtensionContext) {
  const state: Partial<State> = {
    totalSteps: 7,
    step: 0,
  };

  async function collectInputs() {
    // Step 1: Select folder location
    state.step = 1;
    const folderUris = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: "Select Parent Folder",
      title: "Select folder where the Hyperbook will be created",
    });

    if (!folderUris || folderUris.length === 0) {
      return;
    }

    const parentFolder = folderUris[0].fsPath;

    // Step 2: Get book name
    state.step = 2;
    const bookNameInput = await vscode.window.showInputBox({
      title: `Create Hyperbook (${state.step}/${state.totalSteps})`,
      prompt: "What is your book named?",
      value: "my-book",
      validateInput: (value) => {
        if (!value || value.trim() === "") {
          return "Book name is required";
        }
        // Check for invalid characters
        if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
          return "Book name can only contain letters, numbers, hyphens, and underscores";
        }
        return undefined;
      },
    });

    if (!bookNameInput) {
      return;
    }

    state.name = bookNameInput;
    state.bookPath = path.join(parentFolder, bookNameInput);

    // Step 3: Get description
    state.step = 3;
    const description = await vscode.window.showInputBox({
      title: `Create Hyperbook (${state.step}/${state.totalSteps})`,
      prompt: "What is your book about?",
      placeHolder: "Optional description",
    });

    state.description = description || "";

    // Step 4: Get author
    state.step = 4;
    const author = await vscode.window.showInputBox({
      title: `Create Hyperbook (${state.step}/${state.totalSteps})`,
      prompt: "Who is the author of the book?",
      placeHolder: "Author name",
    });

    state.author = author || "";

    // Step 5: Get author URL
    state.step = 5;
    const authorUrl = await vscode.window.showInputBox({
      title: `Create Hyperbook (${state.step}/${state.totalSteps})`,
      prompt: "What is the link to the author's homepage?",
      placeHolder: "https://example.com",
      validateInput: (value) => {
        if (value && value.trim() !== "") {
          try {
            new URL(value);
          } catch {
            return "Please enter a valid URL or leave empty";
          }
        }
        return undefined;
      },
    });

    state.authorUrl = authorUrl || "";

    // Step 6: Select license
    state.step = 6;
    const licenseSelection = await vscode.window.showQuickPick(LICENSE_OPTIONS, {
      title: `Create Hyperbook (${state.step}/${state.totalSteps})`,
      placeHolder: "Pick a license for your book",
    });

    if (!licenseSelection) {
      return;
    }

    if (licenseSelection.value === "custom") {
      const customLicense = await vscode.window.showInputBox({
        title: `Create Hyperbook (${state.step}/${state.totalSteps})`,
        prompt: "Which custom license do you want to use?",
        placeHolder: "License name",
      });
      state.license = customLicense || "custom";
    } else {
      state.license = licenseSelection.value;
    }

    // Step 7: Get language
    state.step = 7;
    const language = await vscode.window.showInputBox({
      title: `Create Hyperbook (${state.step}/${state.totalSteps})`,
      prompt: "In which language is your book written?",
      value: "en",
      placeHolder: "Language code (e.g., en, de, es)",
      validateInput: (value) => {
        if (!value || value.trim() === "") {
          return "Language code is required";
        }
        if (!/^[a-z]{2,3}$/.test(value)) {
          return "Please enter a valid language code (e.g., en, de, es)";
        }
        return undefined;
      },
    });

    if (!language) {
      return;
    }

    state.language = language;

    // Step 8: Select platform
    state.step = 8;
    state.totalSteps = 8;
    const platformSelection = await vscode.window.showQuickPick(PLATFORM_OPTIONS, {
      title: `Create Hyperbook (${state.step}/${state.totalSteps})`,
      placeHolder: "Where do you plan to publish your book?",
    });

    if (!platformSelection) {
      return;
    }

    state.platform = platformSelection.value;

    return state as State;
  }

  const inputs = await collectInputs();
  if (!inputs) {
    return;
  }

  // Create the hyperbook
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Creating Hyperbook",
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "Setting up project..." });

      const options: CreateHyperbookOptions = {
        bookPath: inputs.bookPath,
        name: inputs.name,
        description: inputs.description,
        author: inputs.author,
        authorUrl: inputs.authorUrl,
        license: inputs.license,
        language: inputs.language,
        platform: inputs.platform,
      };

      const result = await createHyperbook(options);

      if (!result.success) {
        vscode.window.showErrorMessage(
          `Failed to create Hyperbook: ${result.error}`
        );
        return;
      }

      progress.report({ message: "Project created successfully!" });

      const openFolder = "Open Folder";
      const choice = await vscode.window.showInformationMessage(
        `Hyperbook "${result.bookName}" created successfully at ${result.root}`,
        openFolder
      );

      if (choice === openFolder) {
        const uri = vscode.Uri.file(result.root);
        await vscode.commands.executeCommand("vscode.openFolder", uri);
      }
    }
  );
}
