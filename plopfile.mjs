export default function (plop) {
  plop.setGenerator("element package", {
    description: "Creates an element TypeScript package.",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "element name please",
      },
    ],
    actions: [
      {
        type: "addMany",
        templateFiles: "plop-templates/element/**/*",
        destination: "packages/element-{{ dashCase name }}/",
        base: "plop-templates/element/",
      },
    ],
  });
  plop.setGenerator("component package", {
    description: "Creates a component TypeScript package.",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "component name please",
      },
    ],
    actions: [
      {
        type: "addMany",
        templateFiles: "plop-templates/component/**/*",
        destination: "packages/{{ dashCase name }}/",
        base: "plop-templates/component/",
      },
    ],
  });
  plop.setGenerator("plain package", {
    description: "Creates a plain TypeScript package.",
    prompts: [
      {
        type: "input",
        name: "packageName",
        message: "package name please",
      },
    ],
    actions: [
      {
        type: "addMany",
        templateFiles: "plop-templates/package/**/*",
        destination: "packages/{{ dashCase packageName }}/",
        base: "plop-templates/package/",
      },
    ],
  });
}
